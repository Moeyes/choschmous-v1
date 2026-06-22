"""Seed the database with realistic Cambodian MoEYS sports-event data.

Populates every domain table with coherent, non-placeholder data:
  - 25 Cambodian provinces + 3 ministries (organizations)
  - 36 sports (real disciplines contested in Cambodian/SEA games)
  - 4 events (one per eventType: National / University / High-School / Primary)
  - per-event sport programmes, categories, org participation declarations
  - thousands of athletes & hundreds of leaders (enrollments + participations)
  - teams, medals, by-number counts, organizer roster, open-survey fields/responses
  - audit rows (pii_access_logs), uploaded files, refresh-token records

Run inside the backend container:
    docker compose exec -T backend uv run python scripts/seed_data.py
    docker compose exec -T backend uv run python scripts/seed_data.py --reset

Without --reset the script refuses to run if organizations already exist (so it
never silently duplicates). --reset TRUNCATEs every seeded table first.

NOT a production tool — development/demo bootstrap only. All seeded login users
share the password below.
"""

import argparse
import asyncio
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

# Make the backend root importable when run as a file.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text  # noqa: E402

from core.database import SessionLocal  # noqa: E402
from core.security import hash_password  # noqa: E402

# Models
from src.models.organization import Organization  # noqa: E402
from src.models.sport import Sport  # noqa: E402
from src.models.user import User  # noqa: E402
from src.models.events import Events  # noqa: E402
from src.models.category import category as Category  # noqa: E402
from src.models.sports_event import sports_event as SportsEvent  # noqa: E402
from src.models.sports_event_org import sports_event_org as SportsEventOrg  # noqa: E402
from src.models.participation_per_sport import (  # noqa: E402
    participation_per_sport as ParticipationPerSport,
)
from src.models.category_survey_review import (  # noqa: E402
    category_survey_review as CategorySurveyReview,
)
from src.models.team import team as Team  # noqa: E402
from src.models.enroll import Enroll  # noqa: E402
from src.models.athletes import athletes as Athlete  # noqa: E402
from src.models.leader import leader as Leader  # noqa: E402
from src.models.athlete_participation import (  # noqa: E402
    athlete_participation as AthleteParticipation,
)
from src.models.leader_participation import (  # noqa: E402
    leader_participation as LeaderParticipation,
)
from src.models.medal import Medal  # noqa: E402
from src.models.organizer_role import OrganizerRole  # noqa: E402
from src.models.organizer_participation import OrganizerParticipation  # noqa: E402
from src.models.open_survey import OpenSurveyField, OpenSurveyResponse  # noqa: E402
from src.models.pii_access_log import PiiAccessLog  # noqa: E402
from src.models.uploaded_file import UploadedFile  # noqa: E402
from src.models.refresh_token import RefreshToken  # noqa: E402

# Enums
from src.models.enum.org import instituteType  # noqa: E402
from src.models.enum.user import (  # noqa: E402
    UserRole,
    IdDocumentType,
    genderEnum,
    medal_typeEnum,
    LeaderRole,
)
from src.models.enum.event import eventType, AgeMode, PhaseStatus, SportMode  # noqa: E402

SEED_PASSWORD = "Moeys@2026"
random.seed(2026)
TODAY = date(2026, 6, 19)

# ── Reference data ────────────────────────────────────────────────────────────

PROVINCES = [
    ("រាជធានីភ្នំពេញ", "Phnom Penh"),
    ("បន្ទាយមានជ័យ", "Banteay Meanchey"),
    ("បាត់ដំបង", "Battambang"),
    ("កំពង់ចាម", "Kampong Cham"),
    ("កំពង់ឆ្នាំង", "Kampong Chhnang"),
    ("កំពង់ស្ពឺ", "Kampong Speu"),
    ("កំពង់ធំ", "Kampong Thom"),
    ("កំពត", "Kampot"),
    ("កណ្ដាល", "Kandal"),
    ("កោះកុង", "Koh Kong"),
    ("ក្រចេះ", "Kratie"),
    ("មណ្ឌលគិរី", "Mondulkiri"),
    ("ឧត្ដរមានជ័យ", "Oddar Meanchey"),
    ("ប៉ៃលិន", "Pailin"),
    ("ព្រះសីហនុ", "Preah Sihanouk"),
    ("ព្រះវិហារ", "Preah Vihear"),
    ("ព្រៃវែង", "Prey Veng"),
    ("ពោធិ៍សាត់", "Pursat"),
    ("រតនគិរី", "Ratanakiri"),
    ("សៀមរាប", "Siem Reap"),
    ("ស្ទឹងត្រែង", "Stung Treng"),
    ("ស្វាយរៀង", "Svay Rieng"),
    ("តាកែវ", "Takeo"),
    ("ត្បូងឃ្មុំ", "Tboung Khmum"),
    ("កែប", "Kep"),
]

MINISTRIES = [
    ("ក្រសួងការពារជាតិ", "Ministry of National Defence"),
    ("ក្រសួងមហាផ្ទៃ", "Ministry of Interior"),
    ("ក្រសួងអប់រំ យុវជន និងកីឡា", "Ministry of Education, Youth and Sport"),
]

# (name_kh, name_en, sport_type, is_team)
SPORTS = [
    ("អត្តពលកម្ម", "Athletics", "Track & Field", False),
    ("ហែលទឹក", "Swimming", "Aquatics", False),
    ("បាល់ទាត់", "Football", "Team", True),
    ("បាល់ទះ", "Volleyball", "Team", True),
    ("បាល់បោះ", "Basketball", "Team", True),
    ("សីដក", "Sepak Takraw", "Team", True),
    ("ប្រដាល់សកល", "Boxing", "Combat", False),
    ("គុនខ្មែរ", "Kun Khmer", "Combat", False),
    ("តេក្វាន់ដូ", "Taekwondo", "Combat", False),
    ("ការ៉ាតេ", "Karate", "Combat", False),
    ("ជូដូ", "Judo", "Combat", False),
    ("ចំបាប់", "Wrestling", "Combat", False),
    ("ស៊ីឡាត់", "Pencak Silat", "Combat", False),
    ("វូវីណាម", "Vovinam", "Combat", False),
    ("កីឡាវាយសី", "Badminton", "Racquet", False),
    ("តេនីសលើតុ", "Table Tennis", "Racquet", False),
    ("តេនីស", "Tennis", "Racquet", False),
    ("ជិះកង់", "Cycling", "Cycling", False),
    ("លើកទម្ងន់", "Weightlifting", "Strength", False),
    ("ប៉េតង់", "Petanque", "Precision", False),
    ("អុកខ្មែរ", "Ouk Chaktrang", "Mind", False),
    ("វូស៊ូ", "Wushu", "Combat", False),
    ("ជូជីតស៊ូ", "Jujitsu", "Combat", False),
    ("អាន់នីស", "Arnis", "Combat", False),
    ("គុនល្បុក្កតោ", "Kun Lbokator", "Combat", False),
    ("បាល់ដៃ", "Handball", "Team", True),
    ("ហ្វុតសាល់", "Futsal", "Team", True),
    ("ហុកគី", "Hockey", "Team", True),
    ("រ៉ាប់ប៊ី", "Rugby", "Team", True),
    ("បាញ់ធ្នូ", "Archery", "Precision", False),
    ("បាញ់កាំភ្លើង", "Shooting", "Precision", False),
    ("កូឡុហ្វ", "Golf", "Precision", False),
    ("ហាត់ប្រាណសិល្បៈ", "Gymnastics", "Artistic", False),
    ("ចែវទូក", "Rowing", "Aquatics", True),
    ("ចែវកាណូ", "Canoeing", "Aquatics", True),
    ("អេស្ព័រ", "Esports", "Mind", True),
]

KH_FAMILY = [
    "សុខ",
    "ចាន់",
    "លី",
    "ហេង",
    "គឹម",
    "ពៅ",
    "រស់",
    "ឈួន",
    "នី",
    "ម៉ៅ",
    "សៀង",
    "ទេព",
    "វង់",
    "ប៊ុន",
    "ខៀវ",
    "សាន",
    "ឌួង",
    "ផល",
    "ងួន",
    "យ៉េ",
]
EN_FAMILY = [
    "Sok",
    "Chan",
    "Ly",
    "Heng",
    "Kim",
    "Pov",
    "Ros",
    "Chhoun",
    "Ny",
    "Mao",
    "Sieng",
    "Tep",
    "Vong",
    "Bun",
    "Kheav",
    "San",
    "Duong",
    "Phal",
    "Nguon",
    "Ye",
]
KH_GIVEN_M = [
    "សុភ័ក្ត្រ",
    "រតនៈ",
    "ពិសិដ្ឋ",
    "ដារា",
    "សំណាង",
    "វិសាល",
    "ចំរើន",
    "សុវណ្ណ",
    "ប៊ុនធឿន",
    "រ៉ាវី",
    "សុខា",
    "ពិសី",
    "វុទ្ធី",
    "កុសល",
    "សិរីបុត្រ",
]
EN_GIVEN_M = [
    "Sopheak",
    "Rattanak",
    "Piseth",
    "Dara",
    "Samnang",
    "Visal",
    "Chamroeun",
    "Sovann",
    "Bunthoeun",
    "Ravy",
    "Sokha",
    "Pisey",
    "Vuthy",
    "Kosal",
    "Sereyboth",
]
KH_GIVEN_F = [
    "សុភា",
    "ស្រីពេជ្រ",
    "ច័ន្ទថា",
    "លីដា",
    "សុគន្ធា",
    "ដាវី",
    "រស្មី",
    "សុជាតា",
    "ច័ន្ទនី",
    "ពេជ្រា",
    "នារី",
    "សោភ័ណ",
    "ស្រីនិច",
    "កញ្ញា",
    "ធីតា",
]
EN_GIVEN_F = [
    "Sophea",
    "Sreypich",
    "Chantha",
    "Lida",
    "Sokunthea",
    "Davy",
    "Raksmey",
    "Sochéata",
    "Channy",
    "Pichara",
    "Neary",
    "Sophorn",
    "Sreynich",
    "Kanha",
    "Thida",
]

ID_DOC_CHOICES = [
    IdDocumentType.CAM_NID,
    IdDocumentType.CAM_BIRTH_CERT,
    IdDocumentType.CAM_FAMILY_BOOK,
    IdDocumentType.CAM_PASSPORT,
]
PHONE_PREFIXES = [
    "010",
    "011",
    "012",
    "015",
    "016",
    "017",
    "069",
    "070",
    "077",
    "078",
    "085",
    "086",
    "087",
    "088",
    "089",
    "092",
    "093",
    "095",
    "096",
    "097",
    "098",
    "099",
]
LEADER_ROLES = list(LeaderRole)
REVIEW_DONE = ["APPROVED", "APPROVED", "APPROVED", "SUBMITTED", "FLAGGED"]

ALL_TABLES = [
    "refresh_tokens",
    "pii_access_logs",
    "uploaded_files",
    "open_survey_responses",
    "open_survey_fields",
    "organizer_participation",
    "organizer_roles",
    "medals",
    "athlete_participation",
    "leader_participation",
    "athletes",
    "leaders",
    "enrollments",
    "participation_per_sport",
    "category_survey_review",
    "sports_event_org",
    "sports_event",
    "teams",
    "categories",
    "events",
    "users",
    "sports",
    "organizations",
]

_used_usernames: set[str] = set()


def slug(name_en: str) -> str:
    base = name_en.lower().replace(",", "").replace(".", "")
    base = "_".join(base.split())
    s = base
    i = 2
    while s in _used_usernames:
        s = f"{base}{i}"
        i += 1
    _used_usernames.add(s)
    return s


def rand_phone() -> str:
    return random.choice(PHONE_PREFIXES) + "".join(
        random.choice("0123456789") for _ in range(6)
    )


def dob_for_event(ev_type: eventType, age_mode: AgeMode, lo: int, hi: int) -> date:
    """Generate a date of birth consistent with the event's age rule."""
    if age_mode == AgeMode.BIRTH_YEAR:
        year = random.randint(lo, hi)
    else:  # EXACT_AGE: lo..hi years old as of TODAY
        age = random.randint(lo, hi)
        year = TODAY.year - age
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return date(year, month, day)


def make_person(gender: genderEnum):
    fam_i = random.randrange(len(KH_FAMILY))
    if gender == genderEnum.MALE:
        gi = random.randrange(len(KH_GIVEN_M))
        return (KH_FAMILY[fam_i], KH_GIVEN_M[gi], EN_FAMILY[fam_i], EN_GIVEN_M[gi])
    gi = random.randrange(len(KH_GIVEN_F))
    return (KH_FAMILY[fam_i], KH_GIVEN_F[gi], EN_FAMILY[fam_i], EN_GIVEN_F[gi])


def divisions_for(sport_type: str) -> list[str]:
    if sport_type == "Combat":
        return ["−54kg", "−60kg", "−67kg", "−75kg"]
    if sport_type == "Strength":
        return ["−61kg", "−73kg", "−89kg", "+89kg"]
    if sport_type == "Track & Field":
        return ["100m", "400m", "Long Jump", "Relay 4x100m"]
    if sport_type == "Aquatics":
        return ["50m Free", "100m Free", "200m Medley"]
    if sport_type == "Racquet":
        return ["Singles", "Doubles"]
    return ["Open"]


async def reset(session) -> None:
    print("Resetting seeded tables (TRUNCATE … RESTART IDENTITY CASCADE)…")
    await session.execute(
        text(f"TRUNCATE {', '.join(ALL_TABLES)} RESTART IDENTITY CASCADE")
    )
    await session.commit()


async def main(do_reset: bool) -> None:
    async with SessionLocal() as session:
        existing = (
            await session.execute(text("SELECT count(*) FROM organizations"))
        ).scalar()
        if existing and not do_reset:
            print(
                f"organizations already has {existing} rows. Re-run with --reset to wipe & reseed."
            )
            return
        if do_reset:
            await reset(session)

        pwd_hash = hash_password(SEED_PASSWORD)

        # 1) Organizations ────────────────────────────────────────────────────
        provinces: list[Organization] = []
        ministries: list[Organization] = []
        for kh, en in PROVINCES:
            o = Organization(
                name_kh=kh,
                name_en=en,
                type=instituteType.PROVINCE,
                code=str(uuid.uuid4()),
            )
            provinces.append(o)
            session.add(o)
        for kh, en in MINISTRIES:
            o = Organization(
                name_kh=kh,
                name_en=en,
                type=instituteType.MINISTRY,
                code=str(uuid.uuid4()),
            )
            ministries.append(o)
            session.add(o)
        orgs = provinces + ministries
        await session.flush()
        moeys = ministries[-1]  # Ministry of Education, Youth and Sport

        # 2) Sports ───────────────────────────────────────────────────────────
        sports: list[Sport] = []
        team_sport_ids: set[int] = set()
        for kh, en, stype, is_team in SPORTS:
            s = Sport(name_kh=kh, sport_type=stype)
            s._en = en  # transient helper for naming
            s._stype = stype
            s._is_team = is_team
            sports.append(s)
            session.add(s)
        await session.flush()
        for s, (_, _, _, is_team) in zip(sports, SPORTS):
            if is_team:
                team_sport_ids.add(s.id)

        # 3) Users ────────────────────────────────────────────────────────────
        users: list[User] = []

        def add_user(
            kh_fam,
            kh_giv,
            en_fam,
            en_giv,
            username,
            role,
            org_id=None,
            sport_id=None,
            superuser=False,
        ):
            u = User(
                kh_family_name=kh_fam,
                kh_given_name=kh_giv,
                en_family_name=en_fam,
                en_given_name=en_giv,
                full_name=f"{en_giv} {en_fam}",
                email=f"{username}@moeys.gov.kh",
                username=username,
                hashed_password=pwd_hash,
                role=role,
                is_active=True,
                is_superuser=superuser,
                organization_id=org_id,
                sport_id=sport_id,
            )
            users.append(u)
            session.add(u)
            return u

        add_user(
            "អ៊ុក",
            "សុវត្ថិ",
            "Ouk",
            "Sovathy",
            "superadmin",
            UserRole.SUPER_ADMIN,
            superuser=True,
        )
        add_user("ឆាយ", "វិចិត្រ", "Chhay", "Vichet", "admin1", UserRole.ADMIN)
        add_user("ម៉ម", "សុធារ៉ា", "Mom", "Sothara", "admin2", UserRole.ADMIN)

        org_user_by_org: dict[int, User] = {}
        for o in orgs:
            g = random.choice([genderEnum.MALE, genderEnum.FEMALE])
            kf, kg, ef, eg = make_person(g)
            prefix = "prov" if o.type == instituteType.PROVINCE else "min"
            u = add_user(
                kf,
                kg,
                ef,
                eg,
                f"{prefix}_{slug(o.name_en)}",
                UserRole.ORGANIZATION,
                org_id=o.id,
            )
            org_user_by_org[o.id] = u

        # A few federation users, each scoped to a popular sport.
        for s in [
            sp
            for sp in sports
            if sp._en
            in (
                "Football",
                "Volleyball",
                "Athletics",
                "Kun Khmer",
                "Taekwondo",
                "Swimming",
            )
        ]:
            g = random.choice([genderEnum.MALE, genderEnum.FEMALE])
            kf, kg, ef, eg = make_person(g)
            add_user(
                kf, kg, ef, eg, f"fed_{slug(s._en)}", UserRole.FEDERATION, sport_id=s.id
            )
        await session.flush()

        # 4) Events ───────────────────────────────────────────────────────────
        def phases(open_all: bool, reg_open: bool):
            """Return a dict of phase status/date kwargs for an event."""
            win_open = TODAY - timedelta(days=20)
            win_close = TODAY + timedelta(days=120)
            d = {}
            for ph in (
                "survey_category",
                "survey_sport",
                "survey_number",
                "survey_open",
                "registration",
            ):
                forced = (ph == "registration" and reg_open) or open_all
                d[f"{ph}_status"] = PhaseStatus.OPEN if forced else PhaseStatus.AUTO
                d[f"{ph}_open_date"] = win_open
                d[f"{ph}_close_date"] = win_close
            return d

        events_spec = [
            dict(
                name_kh="មហោស្រពកីឡាជាតិលើកទី១៥ ឆ្នាំ២០២៦",
                type=eventType.NATIONAL,
                start=date(2026, 11, 20),
                end=date(2026, 12, 5),
                location="ពហុកីឡដ្ឋានជាតិមរតកតេជោ ភ្នំពេញ",
                desc="ការប្រកួតកីឡាជាតិប្រចាំឆ្នាំ ប្រមូលផ្តុំរាជធានី-ខេត្ត និងក្រសួង។",
                age_mode=AgeMode.EXACT_AGE,
                age_min=16,
                age_max=40,
                cap=12000,
                ph=phases(open_all=True, reg_open=True),
                n_sports=22,
            ),
            dict(
                name_kh="កីឡាឧត្តមសិក្សា និងបច្ចេកទេសថ្នាក់ជាតិ ឆ្នាំ២០២៦",
                type=eventType.UNIVERSITY,
                start=date(2026, 8, 10),
                end=date(2026, 8, 20),
                location="សាកលវិទ្យាល័យភូមិន្ទភ្នំពេញ",
                desc="ការប្រកួតកីឡារវាងសាកលវិទ្យាល័យ និងវិទ្យាស្ថានបច្ចេកទេស។",
                age_mode=AgeMode.EXACT_AGE,
                age_min=18,
                age_max=25,
                cap=4000,
                ph=phases(open_all=False, reg_open=True),
                n_sports=14,
            ),
            dict(
                name_kh="កីឡាសិស្សមធ្យមសិក្សាថ្នាក់ជាតិ ឆ្នាំ២០២៦",
                type=eventType.HIGH_SCHOOL,
                start=date(2026, 9, 15),
                end=date(2026, 9, 25),
                location="ខេត្តសៀមរាប",
                desc="ការប្រកួតកីឡាសម្រាប់សិស្សវិទ្យាល័យទូទាំងប្រទេស។",
                age_mode=AgeMode.BIRTH_YEAR,
                age_min=2008,
                age_max=2011,
                cap=3500,
                ph=phases(open_all=False, reg_open=False),
                n_sports=12,
            ),
            dict(
                name_kh="កីឡាសិស្សបឋមសិក្សាថ្នាក់ជាតិ ឆ្នាំ២០២៦",
                type=eventType.PRIMARY_SCHOOL,
                start=date(2026, 7, 1),
                end=date(2026, 7, 10),
                location="ខេត្តបាត់ដំបង",
                desc="ការប្រកួតកីឡាសម្រាប់សិស្សបឋមសិក្សា លើកកម្ពស់សុខភាពកុមារ។",
                age_mode=AgeMode.BIRTH_YEAR,
                age_min=2014,
                age_max=2017,
                cap=2500,
                ph=phases(open_all=False, reg_open=False),
                n_sports=9,
            ),
        ]
        events: list[Events] = []
        for spec in events_spec:
            e = Events(
                name_kh=spec["name_kh"],
                type=spec["type"],
                start_date=spec["start"],
                end_date=spec["end"],
                description=spec["desc"],
                location=spec["location"],
                age_mode=spec["age_mode"],
                age_min=spec["age_min"],
                age_max=spec["age_max"],
                participant_cap=spec["cap"],
                **spec["ph"],
            )
            e._spec = spec
            events.append(e)
            session.add(e)
        await session.flush()

        # 5) Per-event sport programme + categories + sports_event ────────────
        # event -> list of Sport in its programme
        ev_sports: dict[int, list[Sport]] = {}
        # (event_id, sport_id) -> list[Category]
        cats_by_es: dict[tuple[int, int], list[Category]] = {}
        sport_event_rows: dict[tuple[int, int], SportsEvent] = {}
        for e in events:
            programme = random.sample(sports, e._spec["n_sports"])
            ev_sports[e.id] = programme
            for s in programme:
                is_team = s.id in team_sport_ids
                mode = SportMode.TEAM if is_team else SportMode.INDIVIDUAL
                if s._en in ("Tennis", "Table Tennis", "Badminton"):
                    mode = SportMode.BOTH
                se = SportsEvent(
                    events_id=e.id,
                    sports_id=s.id,
                    mode=mode,
                    team_size_min=(5 if is_team else None),
                    team_size_max=(18 if is_team else None),
                    quota_athletes_per_org=random.choice([8, 12, 16, 20]),
                    quota_teams_per_org=(2 if is_team else None),
                )
                session.add(se)
                sport_event_rows[(e.id, s.id)] = se
                # categories: division × gender
                clist: list[Category] = []
                for div in divisions_for(s._stype):
                    for g, glabel in (
                        (genderEnum.MALE, "Male"),
                        (genderEnum.FEMALE, "Female"),
                    ):
                        c = Category(
                            sports_id=s.id,
                            events_id=e.id,
                            category=f"{div} {glabel}",
                            gender=g,
                        )
                        session.add(c)
                        clist.append(c)
                cats_by_es[(e.id, s.id)] = clist
        await session.flush()

        # category_survey_review: one per (event, sport) declared
        for eid, sid in sport_event_rows:
            session.add(
                CategorySurveyReview(
                    events_id=eid,
                    sports_id=sid,
                    status=random.choice(REVIEW_DONE),
                    reviewed_at=datetime.utcnow(),
                )
            )

        # 6) sports_event_org + participation_per_sport (by-number) ───────────
        # Decide which orgs participate in which event, and which sports each fields.
        # event_id -> {org_id: [Sport,...]}
        ev_org_sports: dict[int, dict[int, list[Sport]]] = {}
        seo_rows: list[SportsEventOrg] = []
        for e in events:
            programme = ev_sports[e.id]
            # National: all orgs; others: a random subset of provinces (+ MoEYS)
            if e.type == eventType.NATIONAL:
                part_orgs = list(orgs)
            else:
                k = {
                    eventType.UNIVERSITY: 20,
                    eventType.HIGH_SCHOOL: 18,
                    eventType.PRIMARY_SCHOOL: 16,
                }[e.type]
                part_orgs = random.sample(provinces, k) + [moeys]
            ev_org_sports[e.id] = {}
            for o in part_orgs:
                fielded = random.sample(
                    programme, min(len(programme), random.randint(5, 9))
                )
                ev_org_sports[e.id][o.id] = fielded
                for s in fielded:
                    seo = SportsEventOrg(
                        events_id=e.id,
                        sports_id=s.id,
                        organization_id=o.id,
                        status=random.choice(REVIEW_DONE),
                        reviewed_at=datetime.utcnow(),
                    )
                    session.add(seo)
                    seo._org_id = o.id
                    seo_rows.append(seo)
        await session.flush()

        for seo in seo_rows:
            am = random.randint(3, 14)
            af = random.randint(2, 12)
            session.add(
                ParticipationPerSport(
                    sports_Events_id=seo.id,
                    org_id=seo._org_id,
                    athlete_male_count=am,
                    athlete_female_count=af,
                    leader_male_count=random.randint(1, 3),
                    leader_female_count=random.randint(0, 2),
                    status=random.choice(REVIEW_DONE),
                    reviewed_at=datetime.utcnow(),
                )
            )

        # 7) Teams (for team-mode sports each org fields) ─────────────────────
        # (event_id, sport_id, org_id) -> [Team,...]
        teams_idx: dict[tuple[int, int, int], list[Team]] = {}
        for e in events:
            for org_id, fielded in ev_org_sports[e.id].items():
                org = next(o for o in orgs if o.id == org_id)
                for s in fielded:
                    if s.id not in team_sport_ids:
                        continue
                    cats = cats_by_es[(e.id, s.id)]
                    tlist = []
                    for n in range(random.randint(1, 2)):
                        cat = random.choice(cats)
                        t = Team(
                            event_id=e.id,
                            sport_id=s.id,
                            org_id=org_id,
                            category_id=cat.id,
                            name=f"{org.name_en} {s._en} {chr(65 + n)}",
                        )
                        session.add(t)
                        tlist.append(t)
                    teams_idx[(e.id, s.id, org_id)] = tlist
        await session.flush()

        # 8) Enrollments → athletes / leaders + participations ────────────────
        an_admin = users[1]  # admin1, used as PII-reveal actor later
        athlete_parts: list[AthleteParticipation] = []
        n_enroll = n_ath = n_lead = 0

        per_event_athletes = {
            eventType.NATIONAL: (24, 38),
            eventType.UNIVERSITY: (12, 20),
            eventType.HIGH_SCHOOL: (12, 18),
            eventType.PRIMARY_SCHOOL: (8, 14),
        }
        per_event_leaders = {
            eventType.NATIONAL: (5, 9),
            eventType.UNIVERSITY: (3, 5),
            eventType.HIGH_SCHOOL: (3, 5),
            eventType.PRIMARY_SCHOOL: (2, 4),
        }

        for e in events:
            spec = e._spec
            for org_id, fielded in ev_org_sports[e.id].items():
                creator = org_user_by_org[org_id]
                # Athletes
                lo, hi = per_event_athletes[e.type]
                for _ in range(random.randint(lo, hi)):
                    g = random.choice([genderEnum.MALE, genderEnum.FEMALE])
                    kf, kg, ef, eg = make_person(g)
                    prov_en = next(o for o in orgs if o.id == org_id).name_en
                    enr = Enroll(
                        kh_family_name=kf,
                        kh_given_name=kg,
                        en_family_name=ef,
                        en_given_name=eg,
                        phonenumber=rand_phone(),
                        gender=g,
                        nationality="Cambodian",
                        date_of_birth=dob_for_event(
                            e.type, spec["age_mode"], spec["age_min"], spec["age_max"]
                        ),
                        id_document_type=random.choice(ID_DOC_CHOICES),
                        address=f"ភូមិ{random.randint(1, 9)}, {prov_en}, Cambodia",
                        user_id=creator.id,
                    )
                    session.add(enr)
                    await session.flush()
                    ath = Athlete(enroll_id=enr.id)
                    session.add(ath)
                    await session.flush()
                    n_enroll += 1
                    n_ath += 1
                    # 1–2 sport participations
                    for s in random.sample(
                        fielded, min(len(fielded), random.randint(1, 2))
                    ):
                        cands = [c for c in cats_by_es[(e.id, s.id)] if c.gender == g]
                        cat = random.choice(cands) if cands else None
                        team_id = None
                        if s.id in team_sport_ids:
                            tl = teams_idx.get((e.id, s.id, org_id))
                            if tl:
                                team_id = random.choice(tl).id
                        ap = AthleteParticipation(
                            athletes_id=ath.id,
                            events_id=e.id,
                            sports_id=s.id,
                            category_id=(cat.id if cat else None),
                            organization_id=org_id,
                            team_id=team_id,
                        )
                        session.add(ap)
                        athlete_parts.append(ap)
                # Leaders
                lo, hi = per_event_leaders[e.type]
                for _ in range(random.randint(lo, hi)):
                    g = random.choice([genderEnum.MALE, genderEnum.FEMALE])
                    kf, kg, ef, eg = make_person(g)
                    prov_en = next(o for o in orgs if o.id == org_id).name_en
                    enr = Enroll(
                        kh_family_name=kf,
                        kh_given_name=kg,
                        en_family_name=ef,
                        en_given_name=eg,
                        phonenumber=rand_phone(),
                        gender=g,
                        nationality="Cambodian",
                        date_of_birth=date(
                            random.randint(1975, 1998),
                            random.randint(1, 12),
                            random.randint(1, 28),
                        ),
                        id_document_type=IdDocumentType.CAM_NID,
                        address=f"ភូមិ{random.randint(1, 9)}, {prov_en}, Cambodia",
                        user_id=creator.id,
                    )
                    session.add(enr)
                    await session.flush()
                    ld = Leader(
                        LeaderRole=random.choice(LEADER_ROLES), enroll_id=enr.id
                    )
                    session.add(ld)
                    await session.flush()
                    n_enroll += 1
                    n_lead += 1
                    for s in random.sample(fielded, min(len(fielded), 2)):
                        session.add(
                            LeaderParticipation(
                                leaders_id=ld.id,
                                events_id=e.id,
                                sports_id=s.id,
                                organization_id=org_id,
                            )
                        )
            await session.flush()
            print(f"  · {spec['type'].name}: enrolled so far {n_enroll} people")

        # 9) Medals (National event podium-ish) ───────────────────────────────
        nat = events[0]
        nat_parts = [ap for ap in athlete_parts if ap.events_id == nat.id]
        n_medals = 0
        for ap in random.sample(nat_parts, min(180, len(nat_parts))):
            mt = random.choices(
                [
                    medal_typeEnum.GOLD,
                    medal_typeEnum.SILVER,
                    medal_typeEnum.BRONZE,
                    medal_typeEnum.none,
                ],
                weights=[2, 2, 3, 4],
            )[0]
            session.add(
                Medal(
                    athlete_participation_id=ap.id,
                    medal_type=mt,
                    key_performance=random.choice(
                        [
                            "New national record",
                            "Personal best",
                            "Final round",
                            "Semi-final",
                            "",
                        ]
                    )
                    or None,
                )
            )
            n_medals += 1

        # 10) Organizer roles + roster ───────────────────────────────────────
        ORG_ROLES = [
            ("អាជ្ញាកណ្ដាល", "Referee"),
            ("មន្ត្រីបច្ចេកទេស", "Technical Official"),
            ("បុគ្គលិកពេទ្យ", "Medical Staff"),
            ("អ្នកស្ម័គ្រចិត្ត", "Volunteer"),
            ("អ្នកគ្រប់គ្រងទីលាន", "Venue Manager"),
            ("អ្នកកត់ត្រាលទ្ធផល", "Result Operator"),
        ]
        org_roles = [OrganizerRole(name_kh=kh, name_en=en) for kh, en in ORG_ROLES]
        for r in org_roles:
            session.add(r)
        await session.flush()
        n_org_part = 0
        for e in events:
            for _ in range(random.randint(8, 14)):
                g = random.choice([genderEnum.MALE, genderEnum.FEMALE])
                kf, kg, ef, eg = make_person(g)
                enr = Enroll(
                    kh_family_name=kf,
                    kh_given_name=kg,
                    en_family_name=ef,
                    en_given_name=eg,
                    phonenumber=rand_phone(),
                    gender=g,
                    nationality="Cambodian",
                    date_of_birth=date(
                        random.randint(1980, 2000),
                        random.randint(1, 12),
                        random.randint(1, 28),
                    ),
                    id_document_type=IdDocumentType.CAM_NID,
                    address="ភ្នំពេញ, Cambodia",
                    user_id=an_admin.id,
                )
                session.add(enr)
                await session.flush()
                session.add(
                    OrganizerParticipation(
                        enroll_id=enr.id,
                        event_id=e.id,
                        organization_id=moeys.id,
                        organizer_role_id=random.choice(org_roles).id,
                    )
                )
                n_enroll += 1
                n_org_part += 1

        # 11) Open-survey fields + responses ─────────────────────────────────
        n_resp = 0
        for e in events:
            fields = [
                OpenSurveyField(
                    event_id=e.id,
                    label_kh="ថ្ងៃមកដល់",
                    label_en="Arrival date",
                    field_type="date",
                    sort_order=1,
                ),
                OpenSurveyField(
                    event_id=e.id,
                    label_kh="ចំនួនយានជំនិះ",
                    label_en="Number of vehicles",
                    field_type="number",
                    sort_order=2,
                ),
                OpenSurveyField(
                    event_id=e.id,
                    label_kh="តម្រូវការកន្លែងស្នាក់នៅ",
                    label_en="Accommodation needs",
                    field_type="text",
                    sort_order=3,
                    required=False,
                ),
            ]
            for f in fields:
                session.add(f)
            await session.flush()
            responder_orgs = random.sample(
                list(ev_org_sports[e.id].keys()), min(10, len(ev_org_sports[e.id]))
            )
            for org_id in responder_orgs:
                vals = [
                    f"2026-{random.randint(7, 11):02d}-{random.randint(1, 28):02d}",
                    str(random.randint(1, 6)),
                    random.choice(["Hotel near venue", "Dormitory", "Self-arranged"]),
                ]
                for f, v in zip(fields, vals):
                    session.add(
                        OpenSurveyResponse(
                            field_id=f.id, organization_id=org_id, value=v
                        )
                    )
                    n_resp += 1

        # 12) Uploaded files (tiny 1x1 PNG) ──────────────────────────────────
        PNG_1x1 = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000a49444154789c6360000002000154a24f3f0000000049454e44ae426082"
        )
        for i in range(10):
            session.add(
                UploadedFile(
                    filename=f"athlete_photo_{i + 1}.png",
                    content_type="image/png",
                    size=len(PNG_1x1),
                    data=PNG_1x1,
                    uploaded_by=an_admin.id,
                )
            )

        # 13) PII access logs (audit) + refresh-token records ────────────────
        enroll_ids = (
            (
                await session.execute(
                    text("SELECT id FROM enrollments ORDER BY random() LIMIT 20")
                )
            )
            .scalars()
            .all()
        )
        for eid in enroll_ids:
            session.add(
                PiiAccessLog(
                    actor_user_id=an_admin.id,
                    actor_role="admin",
                    target_enroll_id=eid,
                    fields="phone",
                )
            )
        for _ in range(3):
            session.add(
                RefreshToken(
                    jti=uuid.uuid4().hex,
                    token_hash=uuid.uuid4().hex,
                    user_id=an_admin.id,
                    expires_at=datetime.now(timezone.utc) - timedelta(days=1),
                    revoked=True,
                )
            )

        await session.commit()

        # Summary ─────────────────────────────────────────────────────────────
        async def cnt(t):
            return (await session.execute(text(f"SELECT count(*) FROM {t}"))).scalar()

        print("\n✅ Seed complete. Row counts:")
        for t in [
            "organizations",
            "sports",
            "users",
            "events",
            "categories",
            "sports_event",
            "sports_event_org",
            "participation_per_sport",
            "category_survey_review",
            "teams",
            "enrollments",
            "athletes",
            "leaders",
            "athlete_participation",
            "leader_participation",
            "medals",
            "organizer_roles",
            "organizer_participation",
            "open_survey_fields",
            "open_survey_responses",
            "uploaded_files",
            "pii_access_logs",
            "refresh_tokens",
        ]:
            print(f"   {t:28s} {await cnt(t)}")
        print(f"\nLogin: any seeded username / password '{SEED_PASSWORD}'")
        print(
            "  e.g.  superadmin · admin1 · prov_battambang · min_interior · fed_football"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset",
        action="store_true",
        help="TRUNCATE all seeded tables before inserting",
    )
    args = parser.parse_args()
    asyncio.run(main(args.reset))
