"""Participant response projections (CHOS-206).

Extracted verbatim from ParticipantService._format_row / _format_list_row /
_format_sport_row. Pure functions — they shape a raw DB row mapping into the
response dict. The data-minimization split (list vs detail vs sport panel) is
unchanged.
"""


def format_row(r: dict, role: str) -> dict:
    """Transform a raw DB row mapping into a standardized response dict."""
    created_at = r.get("created_at")
    result = {
        "participant_id": r["participant_id"],
        # Flat aliases consumed by the registrations list table.
        "id": r["participant_id"],
        "created_at": created_at.isoformat() if created_at is not None else None,
        "photo_url": r.get("photoUrl"),
        "sport_name": r.get("sport_name"),
        "event_name": r.get("event_name"),
        "kh_family_name": r["kh_family_name"],
        "kh_given_name": r["kh_given_name"],
        "en_family_name": r["en_family_name"],
        "en_given_name": r["en_given_name"],
        "name_kh": f"{r['kh_family_name']} {r['kh_given_name']}",
        "name_en": f"{r['en_family_name']} {r['en_given_name']}",
        "gender": (
            r["gender"].value.title()
            if hasattr(r["gender"], "value")
            else str(r["gender"]).title()
        ),
        "phone": r["phonenumber"],
        "date_of_birth": (
            r["date_of_birth"].isoformat()
            if r.get("date_of_birth") is not None
            else None
        ),
        "photoUrl": r.get("photoUrl"),
        "nationalityDocumentUrl": r.get("nationalityDocumentUrl"),
        "birthCertificateUrl": r.get("birthCertificateUrl"),
        "nationalIdUrl": r.get("nationalIdUrl"),
        "passportUrl": r.get("passportUrl"),
        "role": role,
        "sport": (
            {"id": r["sport_id"], "name": r["sport_name"]}
            if r.get("sport_id")
            else None
        ),
        "organization": (
            {"id": r["org_id"], "name": r["org_name"]} if r.get("org_id") else None
        ),
        "event_id": r.get("event_id"),
    }

    if role == "athlete":
        result["category"] = (
            {"id": r["category_id"], "name": r["category_name"]}
            if r.get("category_id")
            else None
        )
    else:
        leader_role = r.get("leader_role")
        result["leader_role"] = (
            leader_role.value if hasattr(leader_role, "value") else leader_role
        )

    return result


def format_list_row(r: dict, role: str) -> dict:
    """Lean projection for the registrations LIST/SEARCH view.

    Data minimization (data-governance §2): the list table only needs names,
    photo, sport/event labels and role, so Restricted-PII (phone, DOB,
    national-ID / passport / birth-certificate URLs, gender, address) never
    leaves the server for this view. Full data is served only by the
    single-record detail endpoint via ``_format_row``. Every key here is a
    subset of the columns ``_format_row`` already reads.
    """
    created_at = r.get("created_at")
    leader_role = r.get("leader_role")
    return {
        "id": r["participant_id"],
        "created_at": created_at.isoformat() if created_at is not None else None,
        "kh_family_name": r["kh_family_name"],
        "kh_given_name": r["kh_given_name"],
        "en_family_name": r["en_family_name"],
        "en_given_name": r["en_given_name"],
        "photo_url": r.get("photoUrl"),
        "sport_name": r.get("sport_name"),
        "event_name": r.get("event_name"),
        "role": role,
        "leader_role": (
            None
            if role == "athlete"
            else (leader_role.value if hasattr(leader_role, "value") else leader_role)
        ),
    }


def format_sport_row(r: dict, role: str) -> dict:
    """Richer projection for the sport-detail participant panel.

    Carries the category / gender / organization / event fields the
    by-category participant table renders. Phone stays out — it is
    Restricted-PII, revealed only on demand via the audited endpoint
    (data-governance §2). Keys mirror the frontend SportParticipant shape.
    """
    dob = r.get("date_of_birth")
    gender = r.get("gender")
    leader_role = r.get("leader_role")
    sport_id = r.get("sport_id")
    org_id = r.get("org_id")
    category_id = r.get("category_id")
    name_kh = " ".join(
        p for p in (r.get("kh_family_name"), r.get("kh_given_name")) if p
    ).strip()
    name_en = " ".join(
        p for p in (r.get("en_family_name"), r.get("en_given_name")) if p
    ).strip()
    return {
        "participant_id": r["participant_id"],
        "name_kh": name_kh,
        "name_en": name_en,
        "gender": (
            (gender.value if hasattr(gender, "value") else str(gender))
            if gender is not None
            else ""
        ),
        "date_of_birth": dob.isoformat() if dob is not None else None,
        "photoUrl": r.get("photoUrl"),
        "role": role,
        "sport": (
            {"id": sport_id, "name": r.get("sport_name")}
            if sport_id is not None
            else None
        ),
        "organization": (
            {"id": org_id, "name": r.get("org_name")} if org_id is not None else None
        ),
        "event_id": r.get("events_id"),
        "category": (
            {"id": category_id, "name": r.get("category_name")}
            if role == "athlete" and category_id is not None
            else None
        ),
        "leader_role": (
            None
            if role == "athlete"
            else (leader_role.value if hasattr(leader_role, "value") else leader_role)
        ),
    }
