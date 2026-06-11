from enum import Enum as PyEnum

class eventType(PyEnum):
    NATIONAL = "កីឡាជាតិ"
    UNIVERSITY = "កីឡាឧត្តមសិក្សា និងមធ្យមសិក្សា​បចេ្ចកទេសថ្នាក់ជាតិថ្នាក់ជាតិ"
    HIGH_SCHOOL = "សិស្សមធ្យមសិក្សា​ថ្នាក់ជាតិ"
    PRIMARY_SCHOOL = "កីឡាសិស្សបឋមសិក្សាជាតិ"


class AgeMode(PyEnum):
    """How an event's age_min/age_max are interpreted."""
    BIRTH_YEAR = "BIRTH_YEAR"
    EXACT_AGE = "EXACT_AGE"


class PhaseStatus(PyEnum):
    """
    Lifecycle gate for a single event phase.

    - AUTO   : phase is open only while today is within [open_date, close_date].
    - OPEN   : phase forced open regardless of dates.
    - CLOSED : phase forced closed regardless of dates.
    """
    AUTO = "AUTO"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
