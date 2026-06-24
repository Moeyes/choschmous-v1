"""CHOS-306: Locust load scenarios — login / register / dashboard / report.

Target: sustain ~3,000 RPS across the mix (see tests/load/CAPACITY_REPORT.md for
the methodology, capacity model, and how the read replicas (CHOS-301), Redis
Cluster (CHOS-302) and the Cloudflare edge (CHOS-303) factor in).

Run the full mix against a staging host (NOT prod, NOT local single-node):

    export LOAD_TEST_PASSWORD=...                 # password the users were seeded with
    export LOAD_TEST_USER_COUNT=500               # distinct accounts (see seed_load_users.py)
    export LOAD_EVENT_ID=1 LOAD_SPORT_ID=1 LOAD_ORG_ID=1 LOAD_CATEGORY_ID=1   # for register/report
    uv run locust -f tests/load/locustfile.py --host https://staging.example \
        --users 3000 --spawn-rate 100 --run-time 10m --headless

IMPORTANT — rate limits shape the test (core/ratelimit.py):
  * login is 5 req / 60s PER IP  → drive from many source IPs (distributed
    workers), and log in ONCE per user (this file does, in on_start).
  * dashboard 30 / report 10 / register 10 — all PER USER / 60s. To reach 3k RPS
    of *successful* traffic you therefore need ~thousands of DISTINCT users
    (LOAD_TEST_USER_COUNT), each staying under its own per-user budget — exactly
    how real traffic is shaped. A handful of users will just measure the limiter.

The CI smoke step runs only the read tag (login + dashboard + events) at low
concurrency, so it needs no seeded reference data.
"""

from __future__ import annotations

import itertools
import os
import random
import time

from locust import HttpUser, between, events, tag, task

# --- configuration (env) ----------------------------------------------------
PASSWORD = os.getenv("LOAD_TEST_PASSWORD", "LoadTest!2026Pass")
USER_COUNT = int(os.getenv("LOAD_TEST_USER_COUNT", "5"))
USER_PREFIX = os.getenv("LOAD_TEST_USER_PREFIX", "loaduser")

# Reference ids for the write/report scenarios; if unset those tasks no-op so the
# read-only smoke still runs cleanly.
EVENT_ID = os.getenv("LOAD_EVENT_ID")
SPORT_ID = os.getenv("LOAD_SPORT_ID")
ORG_ID = os.getenv("LOAD_ORG_ID")
CATEGORY_ID = os.getenv("LOAD_CATEGORY_ID")

API = "/api/v1"
# Round-robin account assignment so each Locust user is a distinct account and
# per-user rate limits don't collapse the whole test onto one key.
_user_counter = itertools.count()


class MoeysUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self) -> None:
        """Log in once (login is CSRF-exempt). The session keeps the access_token
        + csrf_token cookies for the rest of this user's life."""
        n = next(_user_counter) % max(USER_COUNT, 1)
        self.username = f"{USER_PREFIX}{n + 1}"
        self._login()

    def _login(self) -> bool:
        # login is rate-limited 5/60s per IP — tolerate a 429 with one backoff.
        for attempt in range(2):
            with self.client.post(
                f"{API}/auth/login",
                json={"username": self.username, "password": PASSWORD},
                name="POST /auth/login",
                catch_response=True,
            ) as resp:
                if resp.status_code == 200:
                    resp.success()
                    return True
                if resp.status_code == 429 and attempt == 0:
                    resp.success()  # expected throttle, not a server failure
                    time.sleep(2)
                    continue
                resp.failure(f"login failed: {resp.status_code}")
                return False
        return False

    def _csrf_headers(self) -> dict:
        token = self.client.cookies.get("csrf_token")
        return {"X-CSRF-Token": token} if token else {}

    # ---- READ: dashboard (routes to read replica, CHOS-301) ----------------
    @tag("read")
    @task(6)
    def dashboard(self) -> None:
        with self.client.get(
            f"{API}/dashboard", name="GET /dashboard", catch_response=True
        ) as resp:
            # 429 is the limiter doing its job, not a server error.
            if resp.status_code in (200, 429):
                resp.success()
            else:
                resp.failure(f"dashboard: {resp.status_code}")

    # ---- READ: a simple list read (always available) -----------------------
    @tag("read")
    @task(4)
    def list_events(self) -> None:
        with self.client.get(
            f"{API}/events?skip=0&limit=20", name="GET /events", catch_response=True
        ) as resp:
            if resp.status_code in (200, 429):
                resp.success()
            else:
                resp.failure(f"events: {resp.status_code}")

    # ---- REPORT: enqueue a render (off-request-path, CHOS-202) -------------
    @tag("report")
    @task(2)
    def report(self) -> None:
        if not EVENT_ID:
            return
        with self.client.get(
            f"{API}/reports/sport-list?event_id={EVENT_ID}",
            name="GET /reports/{key}",
            catch_response=True,
        ) as resp:
            # 202 enqueued / 200 / 429 throttled are all acceptable outcomes.
            if resp.status_code in (200, 202, 429):
                resp.success()
            else:
                resp.failure(f"report: {resp.status_code}")

    # ---- WRITE: register a participant -------------------------------------
    @tag("write")
    @task(1)
    def register(self) -> None:
        if not (EVENT_ID and SPORT_ID and ORG_ID and CATEGORY_ID):
            return
        suffix = random.randint(1, 10_000_000)
        body = {
            "role": "athlete",
            "kh_family_name": "សុខ",
            "kh_given_name": f"ដារ៉ា{suffix}",
            "en_family_name": "SOK",
            "en_given_name": f"DARA{suffix}",
            "gender": "MALE",
            "date_of_birth": "2008-01-01",
            "nationality": "Cambodian",
            "id_document_type": "CAM_NID",
            "phonenumber": f"0{random.randint(10_000_000, 99_999_999)}",
            "eventId": int(EVENT_ID),
            "sportId": int(SPORT_ID),
            "organizationId": int(ORG_ID),
            "categoryId": int(CATEGORY_ID),
            "force": True,  # bypass the soft duplicate check under synthetic load
        }
        with self.client.post(
            f"{API}/registration",
            json=body,
            headers=self._csrf_headers(),
            name="POST /registration",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 201, 409, 429):
                resp.success()
            else:
                resp.failure(f"register: {resp.status_code}")


@events.quitting.add_listener
def _assert_capacity(environment, **_kwargs) -> None:
    """Fail the run (non-zero exit) on an SLO breach so CI catches a regression.

    * error ratio > 2% always fails — the robust tripwire for both the CI smoke
      and a real capacity run (expected 429s are marked success in the tasks, so
      this only counts genuine failures).
    * the p95 latency SLO (< 2s) is only asserted once there is a STATISTICALLY
      MEANINGFUL sample (>= 200 requests). The tiny, cold-start CI smoke would
      otherwise flake on a single warmup request / the intentionally heavy bcrypt
      login; a real 3k-RPS run easily clears 200 requests and is gated on it.
    """
    stats = environment.stats.total
    if stats.num_requests == 0:
        return
    fail_ratio = stats.num_failures / stats.num_requests
    if fail_ratio > 0.02:
        environment.process_exit_code = 1
        return
    if stats.num_requests >= 200:
        p95 = stats.get_response_time_percentile(0.95)
        if p95 and p95 > 2000:
            environment.process_exit_code = 1
