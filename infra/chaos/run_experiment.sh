#!/usr/bin/env bash
# CHOS-502 — chaos experiment runner with a steady-state guard.
#
# Applies a Chaos Mesh manifest, then continuously checks the steady-state
# hypothesis (GET /health/ready == 200). If readiness stays broken longer than
# the grace window, the experiment is ABORTED (the chaos resource is deleted) so
# the test can never become the outage it is meant to guard against.
#
# Usage:
#   run_experiment.sh <manifest.yaml> <base_url> [duration_s] [grace_s]
#
# Read-only against prod data; targets the STAGING namespace per the manifests.
# Requires: kubectl (context set to the target cluster) + curl.
set -euo pipefail

MANIFEST="${1:?usage: run_experiment.sh <manifest.yaml> <base_url> [duration_s] [grace_s]}"
BASE_URL="${2:?base_url required, e.g. https://staging.moeys.gov.kh}"
DURATION="${3:-120}"   # how long to hold the experiment
GRACE="${4:-30}"       # max contiguous seconds readiness may stay down before abort
INTERVAL=2

READY_URL="${BASE_URL%/}/health/ready"

log() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$*"; }

probe_ready() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$READY_URL" || echo 000)
  [ "$code" = "200" ]
}

cleanup() {
  log "cleanup: deleting chaos resource"
  kubectl delete -f "$MANIFEST" --ignore-not-found >/dev/null 2>&1 || true
}
trap cleanup EXIT

log "baseline steady-state check ($READY_URL)"
probe_ready || { log "ABORT: system not healthy BEFORE chaos — fix first"; exit 2; }

log "injecting fault: $MANIFEST"
kubectl apply -f "$MANIFEST"

down_for=0
elapsed=0
while [ "$elapsed" -lt "$DURATION" ]; do
  if probe_ready; then
    [ "$down_for" -ne 0 ] && log "recovered after ${down_for}s"
    down_for=0
  else
    down_for=$((down_for + INTERVAL))
    log "readiness DOWN (${down_for}s / grace ${GRACE}s)"
    if [ "$down_for" -ge "$GRACE" ]; then
      log "ABORT: steady-state broken > grace window — halting experiment"
      exit 1
    fi
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

log "experiment complete — steady-state held (max contiguous downtime < ${GRACE}s)"
# trap cleanup removes the chaos resource on exit.
