#!/usr/bin/env python
"""CHOS-503 — mutation-testing gate.

Runs mutmut over the configured scope (``[tool.mutmut]`` in pyproject — the ABAC
engine decision core) and fails if the mutant **kill rate** is below the
threshold (default 70%). Wired into CI (``.github/workflows/contract.yml``).

The run's rich progress summary is suppressed on a non-tty, so we read the
persisted per-mutant statuses via ``mutmut results --all true`` (reliable). A
mutant that is killed or times out is "caught"; survived/suspicious is not. Rate
= caught / total.

Usage: python scripts/mutation_gate.py   (env: MUTATION_THRESHOLD, default 70)
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

THRESHOLD = float(os.environ.get("MUTATION_THRESHOLD", "70"))


def main() -> int:
    # Start clean so the run actually re-evaluates every mutant.
    shutil.rmtree("mutants", ignore_errors=True)
    subprocess.run([sys.executable, "-m", "mutmut", "run"], text=True)

    res = subprocess.run(
        [sys.executable, "-m", "mutmut", "results", "--all", "true"],
        capture_output=True,
        text=True,
    )
    out = res.stdout
    killed = out.count(": killed")
    survived = out.count(": survived")
    timeout = out.count(": timeout")
    suspicious = out.count(": suspicious")

    total = killed + survived + timeout + suspicious
    caught = killed + timeout  # a timeout means the mutant was detected
    rate = (100.0 * caught / total) if total else 0.0
    print(
        f"mutation kill rate: {caught}/{total} = {rate:.1f}% "
        f"(killed={killed} timeout={timeout} survived={survived} "
        f"suspicious={suspicious}; threshold {THRESHOLD:.0f}%)"
    )
    if total == 0:
        sys.stderr.write("FAIL: no mutants evaluated (mutmut/config problem).\n")
        return 2
    if rate < THRESHOLD:
        sys.stderr.write(
            f"FAIL: kill rate {rate:.1f}% < {THRESHOLD:.0f}%. "
            "Survivors (strengthen the unit tests):\n"
        )
        survivors = subprocess.run(
            [sys.executable, "-m", "mutmut", "results"],
            capture_output=True,
            text=True,
        )
        sys.stderr.write(survivors.stdout)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
