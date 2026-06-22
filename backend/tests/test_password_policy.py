"""Unit tests for the password-strength policy.

Locks in the public-sector baseline (ASVS 5.0 L1): minimum 12 characters, mixed
case + digit, and rejection of well-known weak passwords. Regressions here would
silently weaken every new credential, so the policy is pinned by test.
"""

import pytest

from core.security import validate_password_strength


def test_accepts_a_strong_password():
    # 12 chars, upper + lower + digit, not a common password.
    validate_password_strength("ValidPass123")


@pytest.mark.parametrize(
    "password",
    [
        "Short1Aaaa",  # 10 chars — below the 12-char minimum
        "alllowercase123",  # no uppercase
        "ALLUPPERCASE123",  # no lowercase
        "NoDigitsHereAA",  # no digit
        "Password1234",  # passes complexity but is a common weak password
        "Aa1" + "x" * 200,  # exceeds the 128-char maximum
    ],
)
def test_rejects_weak_passwords(password):
    with pytest.raises(ValueError):
        validate_password_strength(password)
