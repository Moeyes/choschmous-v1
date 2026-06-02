# Pre-Demo Checklist

Work top to bottom. If anything fails, see `ROLLBACK.md`.

## T-1 hour
- [ ] Staging URL loads over HTTPS (no cert warning).
- [ ] Backend reachable: `GET /api/openapi.json` returns JSON.
- [ ] All **5 logins** work (admin, superadmin, federation, phnom_penh, + one more org) — from the browser, not curl.
- [ ] Sample data visible: Events list shows `កីឡាជាតិ ២០២៦`; Submissions shows 1 **SUBMITTED** survey; Sports list shows **48**.
- [ ] By-number survey matrix loads and totals compute.
- [ ] Athlete registration: under-18 DOB triggers the birth-certificate requirement.
- [ ] Reports screen: selecting event+org shows aggregated counts (data on screen; exports are narrated — see DEMO_SCRIPT step 5).
- [ ] **Khmer renders** in Kantumruy Pro everywhere (no tofu boxes), incl. table headers and the report.
- [ ] Internet/venue Wi-Fi tested from the actual demo machine; have a phone hotspot as backup.
- [ ] DB backup taken (see ROLLBACK.md §Backup).

## T-15 min
- [ ] Final login test as **admin** and **phnom_penh**; then log out.
- [ ] Quiet notifications: OS Do-Not-Disturb on, Slack/email/chat closed, phone silent.
- [ ] Tabs pre-opened in order: Dashboard, Events, By-Sport, By-Number, Register, Submissions, Reports.
- [ ] Browser zoom ~110–125% for projector legibility; close unrelated tabs/extensions.
- [ ] Screen recording fallback ready (see During / Fallback).

## During
- [ ] Follow `DEMO_SCRIPT.md` section by section; watch the clock (3/5/2/2/3 min).
- [ ] Narrate the report-export limitation honestly; don't click a non-working download.
- [ ] Note feedback verbatim (have a notes doc open on a second device).
- [ ] Close with: **"For production, what would you prioritize first?"**

## Fallback
- [ ] If staging breaks mid-demo: switch to **localhost** (backend `make dev` on :8000, frontend `pnpm dev`) — data is identical (same `seed.py`).
- [ ] If both break: play the **pre-recorded screen capture** of the full flow.
- [ ] Keep `CREDENTIALS.md` open on a private screen for quick re-login.
