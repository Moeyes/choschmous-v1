from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Dict, Any, Optional

from src.models.athletes import Athlete
from src.models.leader import Leader
from src.models.athlete_participation import AthleteParticipation
from src.models.leader_participation import LeaderParticipation


async def get_card_by_p_id(
    p_id: str, org_id: int, event_id: int, db: AsyncSession
) -> Optional[Dict[str, Any]]:
    if not p_id or not p_id.isdigit():
        return None

    athlete_part_stmt = (
        select(AthleteParticipation)
        .options(
            selectinload(AthleteParticipation.athlete).selectinload(Athlete.enroll),
            selectinload(AthleteParticipation.sport),
            selectinload(AthleteParticipation.organization),
        )
        .where(
            AthleteParticipation.athletes_id == int(p_id),
            AthleteParticipation.organization_id == org_id,
            AthleteParticipation.events_id == event_id,
        )
    )
    athlete_part_result = await db.execute(athlete_part_stmt)
    athlete_part = athlete_part_result.scalar_one_or_none()

    if athlete_part and athlete_part.athlete and athlete_part.athlete.enroll:
        enroll = athlete_part.athlete.enroll
        sport_name = athlete_part.sport.name_kh if athlete_part.sport else "Unknown"
        org_name = (
            athlete_part.organization.name_kh
            if athlete_part.organization
            else "Unknown"
        )

        return {
            "id": athlete_part.athlete.id,
            "name": f"{enroll.kh_family_name} {enroll.kh_given_name}",
            "gender": enroll.gender.value,
            "sport": sport_name,
            "role": "Athlete",
            "org_name": org_name,
            "card_type": "F",
            "profile_image": enroll.photo_path,
        }

    leader_part_stmt = (
        select(LeaderParticipation)
        .options(
            selectinload(LeaderParticipation.leader_obj).selectinload(Leader.enroll),
            selectinload(LeaderParticipation.sport),
            selectinload(LeaderParticipation.organization),
        )
        .where(
            LeaderParticipation.leaders_id == int(p_id),
            LeaderParticipation.organization_id == org_id,
            LeaderParticipation.events_id == event_id,
        )
    )
    leader_part_result = await db.execute(leader_part_stmt)
    leader_part = leader_part_result.scalar_one_or_none()

    if leader_part and leader_part.leader_obj and leader_part.leader_obj.enroll:
        enroll = leader_part.leader_obj.enroll
        sport_name = leader_part.sport.name_kh if leader_part.sport else "Unknown"
        org_name = (
            leader_part.organization.name_kh if leader_part.organization else "Unknown"
        )

        return {
            "id": leader_part.leader_obj.id,
            "name": f"{enroll.kh_family_name} {enroll.kh_given_name}",
            "gender": enroll.gender.value,
            "sport": sport_name,
            "role": leader_part.leader_obj.LeaderRole.value,
            "org_name": org_name,
            "card_type": "Fo",
            "profile_image": enroll.photo_path,
        }

    return None


async def get_cards_by_org_event(org_id: int, event_id: int, db: AsyncSession) -> dict:
    athlete_count_stmt = (
        select(func.count())
        .select_from(AthleteParticipation)
        .where(
            AthleteParticipation.organization_id == org_id,
            AthleteParticipation.events_id == event_id,
        )
    )
    leader_count_stmt = (
        select(func.count())
        .select_from(LeaderParticipation)
        .where(
            LeaderParticipation.organization_id == org_id,
            LeaderParticipation.events_id == event_id,
        )
    )

    athlete_count_result = await db.execute(athlete_count_stmt)
    leader_count_result = await db.execute(leader_count_stmt)

    total_athletes = athlete_count_result.scalar()
    total_leaders = leader_count_result.scalar()
    total = total_athletes + total_leaders

    athlete_part_stmt = (
        select(AthleteParticipation)
        .options(
            selectinload(AthleteParticipation.athlete).selectinload(Athlete.enroll),
            selectinload(AthleteParticipation.sport),
            selectinload(AthleteParticipation.organization),
        )
        .where(
            AthleteParticipation.organization_id == org_id,
            AthleteParticipation.events_id == event_id,
        )
    )
    athlete_part_results = await db.execute(athlete_part_stmt)
    athlete_parts = athlete_part_results.scalars().all()

    data = []
    for ap in athlete_parts:
        athlete_obj = ap.athlete
        if athlete_obj and athlete_obj.enroll:
            enroll = athlete_obj.enroll
            sport_name = ap.sport.name_kh if ap.sport else "Unknown"
            org_name = ap.organization.name_kh if ap.organization else "Unknown"
            data.append(
                {
                    "id": athlete_obj.id,
                    "name": f"{enroll.kh_family_name} {enroll.kh_given_name}",
                    "gender": enroll.gender.value,
                    "sport": sport_name,
                    "role": "Athlete",
                    "org_name": org_name,
                    "card_type": "F",
                    "profile_image": enroll.photo_path,
                    "p_id": str(athlete_obj.id),
                    "org_id": org_id,
                    "event_id": event_id,
                }
            )

    leader_part_stmt = (
        select(LeaderParticipation)
        .options(
            selectinload(LeaderParticipation.leader_obj).selectinload(Leader.enroll),
            selectinload(LeaderParticipation.sport),
            selectinload(LeaderParticipation.organization),
        )
        .where(
            LeaderParticipation.organization_id == org_id,
            LeaderParticipation.events_id == event_id,
        )
    )
    leader_part_results = await db.execute(leader_part_stmt)
    leader_parts = leader_part_results.scalars().all()

    for lp in leader_parts:
        leader_obj = lp.leader_obj
        if leader_obj and leader_obj.enroll:
            enroll = leader_obj.enroll
            sport_name = lp.sport.name_kh if lp.sport else "Unknown"
            org_name = lp.organization.name_kh if lp.organization else "Unknown"
            data.append(
                {
                    "id": leader_obj.id,
                    "name": f"{enroll.kh_family_name} {enroll.kh_given_name}",
                    "gender": enroll.gender.value,
                    "sport": sport_name,
                    "role": leader_obj.LeaderRole.value,
                    "org_name": org_name,
                    "card_type": "Fo",
                    "profile_image": enroll.photo_path,
                    "p_id": str(leader_obj.id),
                    "org_id": org_id,
                    "event_id": event_id,
                }
            )

    return {
        "cards": data,
        "total": total,
    }
