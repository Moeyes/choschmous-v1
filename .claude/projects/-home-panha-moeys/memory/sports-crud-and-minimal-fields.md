---
name: sports-crud-and-minimal-fields
description: Sports backend model is minimal (name_kh + sport_type only); frontend had phantom fields
metadata:
  type: project
---

The `sports` DB table (`backend/src/models/sport.py`) has only `id, name_kh, sport_type, created_at`. The API schema `SportPublic`/`SportCreate`/`SportUpdate` mirror this. There is **no `name_en`, `description`, `category_count`, or `updated_at`**, even though the frontend `Sport` type and UI referenced them (they silently never persisted / always showed 0).

On 2026-06-03 the sport UI was trimmed to the real fields (form + list show only name_kh + sport_type). The backend `sports.py` router was also missing `PATCH /{sport_id}` and `DELETE /{sport_id}` (service methods `update_sport`/`delete_sport` existed but were never wired) — so sport edit was 404-broken and delete absent. Both routes were added at the END of the file (after the static `/category` routes, so FastAPI matches `/category` before `/{sport_id}`). Full CRUD now lives at `/api/sports/` (GET/POST) and `/api/sports/{sport_id}` (GET/PATCH/DELETE).

**Caveat:** DELETE sport has no FK-cascade guard — deleting a sport referenced by categories/event-assignments/registrations may raise an IntegrityError (500). Consider catching it → 409.

Related role-gating: [[superadmin-role-gate-bug]].
