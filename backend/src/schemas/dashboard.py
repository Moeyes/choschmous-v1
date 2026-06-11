from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class StatsResponse(BaseModel):
    events: int
    sports: int
    participants: int
    registrations: int
    organizations: int
    athletes: int
    leaders: int


class EventDashboard(BaseModel):
    id: int
    name: str
    type: str
    createdAt: datetime
    model_config = ConfigDict(from_attributes=True)


class SportDashboard(BaseModel):
    id: int
    name: str
    sportType: Optional[str] = None
    createdAt: datetime
    model_config = ConfigDict(from_attributes=True)


class TopOrganization(BaseModel):
    name: str
    participants: int
    type: str


class RecentEnrollment(BaseModel):
    id: int
    khName: str
    enName: str
    gender: str
    phone: str
    createdAt: datetime


class GenderDistribution(BaseModel):
    male: int
    female: int
    other: int


class DashboardData(BaseModel):
    stats: StatsResponse
    events: List[EventDashboard]
    sports: List[SportDashboard]
    topOrganizations: List[TopOrganization]
    recentEnrollments: List[RecentEnrollment]
    genderDistribution: GenderDistribution


class DashboardResponse(BaseModel):
    success: bool = True
    data: DashboardData


def format_events(events: list) -> List[EventDashboard]:
    return [
        EventDashboard(
            id=event.id,
            name=event.name_kh,
            type=event.type.value if hasattr(event.type, "value") else str(event.type),
            createdAt=event.created_at,
        )
        for event in events
    ]


def format_sports(sports: list) -> List[SportDashboard]:
    return [
        SportDashboard(
            id=sport.id,
            name=sport.name_kh,
            sportType=sport.sport_type,
            createdAt=sport.created_at,
        )
        for sport in sports
    ]


def format_top_organizations(orgs: list) -> List[TopOrganization]:
    return [
        TopOrganization(
            name=org[0],
            participants=org[2] or 0,
            type=org[1].value if hasattr(org[1], "value") else str(org[1]),
        )
        for org in orgs
    ]


def format_recent_enrollments(enrollments: list) -> List[RecentEnrollment]:
    return [
        RecentEnrollment(
            id=enrollment.id,
            khName=f"{enrollment.kh_family_name} {enrollment.kh_given_name}",
            enName=f"{enrollment.en_family_name} {enrollment.en_given_name}",
            gender=(
                enrollment.gender.value
                if hasattr(enrollment.gender, "value")
                else str(enrollment.gender)
            ),
            phone=enrollment.phonenumber or "",
            createdAt=enrollment.created_at,
        )
        for enrollment in enrollments
    ]
