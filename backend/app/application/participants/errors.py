"""Shared error + age helpers for the participants use-cases (CHOS-206).

Extracted verbatim from ParticipantService._raise / _age_on.
"""

from __future__ import annotations

from datetime import date

from fastapi import HTTPException


def raise_localized(status_code: int, code: str, message: str, **params):
    """Raise an HTTPException with a structured detail the UI can localize."""
    detail = {"code": code, "message": message}
    if params:
        detail["params"] = params
    raise HTTPException(status_code=status_code, detail=detail)


def age_on(dob: date, on_date: date) -> int:
    return (
        on_date.year - dob.year - ((on_date.month, on_date.day) < (dob.month, dob.day))
    )
