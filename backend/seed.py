import asyncio
import os
import sys
from core.database import Base, SessionLocal, engine
from src.models.user import User
from src.models.organization import Organization
from src.models.sport import Sport
from src.models.events import Events
from src.models.enum.user import UserRole
from src.models.enum.event import eventType
from src.models.enum.org import instituteType

PROVINCES = [
    "រាជធានីភ្នំពេញ",
    "បន្ទាយមានជ័យ",
    "បាត់ដំបង",
    "កំពង់ចាម",
    "កំពង់ឆ្នាំង",
    "កំពង់ស្ពឺ",
    "កំពង់ធំ",
    "កំពត",
    "កណ្ដាល",
    "កែប",
    "កោះកុង",
    "ក្រចេះ",
    "មណ្ឌលគិរី",
    "ឧត្តរមានជ័យ",
    "ប៉ៃលិន",
    "ព្រះសីហនុ",
    "ព្រះវិហារ",
    "ព្រៃវែង",
    "ពោធិ៍សាត់",
    "រតនគិរី",
    "សៀមរាប",
    "ស្ទឹងត្រែង",
    "ស្វាយរៀង",
    "តាកែវ",
    "ត្បូងឃ្មុំ",
]

MINISTRIES = [
    ("ក្រសួងអប់រំ យុវជន និងកីឡា", "MOEYS"),
    ("ក្រសួងមហាផ្ទៃ", "MOIH"),
    ("ក្រសួងការពារជាតិ", "MOND"),
]

SPORT_NAMES = [
    ("បាល់ទាត់", "Football"),
    ("បាល់ទះ", "Volleyball"),
    ("បាល់បោះ", "Basketball"),
    ("អត្តពលកម្ម", "Athletics"),
    ("ហែលទឹក", "Swimming"),
    ("តេក្វាន់ដូ", "Taekwondo"),
    ("ល្បុក្កតោ", "Bokator"),
    ("អុកចត្រង្គ", "Chess"),
    ("វាយសី", "Badminton"),
]

# Demo org accounts: (username, email, org_index, kh_family, kh_given, en_family, en_given)
# org_index refers to position in the orgs list seeded below (0-based)
DEMO_ORG_ACCOUNTS = [
    ("phnom_penh", "phnom.penh@sport.gov.kh", 0,
     "ហែម", "សុវណ្ណ", "Hem", "Sovann"),        # រាជធានីភ្នំពេញ
    ("siem_reap", "siem.reap@sport.gov.kh", 20,
     "សុខ", "រាជ", "Sok", "Reach"),             # សៀមរាប (index 20)
    ("battambang", "battambang@sport.gov.kh", 2,
     "ចិន", "វិច្ឆិកា", "Chin", "Vicheka"),    # បាត់ដំបង (index 2)
    ("moeys_org", "moeys@sport.gov.kh", 25,
     "មាស", "សីហា", "Meas", "Seyha"),           # ក្រសួងអប់រំ (index 25, first ministry)
    ("kandal", "kandal@sport.gov.kh", 8,
     "គង់", "ឧត្តម", "Kong", "Odom"),           # កណ្ដាល (index 8)
]

# Demo federation accounts: (username, email, sport_index, kh_family, kh_given, en_family, en_given)
# sport_index refers to position in SPORT_NAMES (0-based). A federation user is
# bound to exactly one sport via users.sport_id and may only manage that sport's
# categories — e.g. the volleyball federation never sees football categories.
DEMO_FEDERATION_ACCOUNTS = [
    ("football_fed", "football.fed@sport.gov.kh", 0,
     "ឈួន", "ពិសិដ្ឋ", "Chhoun", "Piseth"),    # បាល់ទាត់ (Football)
    ("volleyball_fed", "volleyball.fed@sport.gov.kh", 1,
     "នួន", "សុធា", "Nuon", "Sotha"),           # បាល់ទះ (Volleyball)
]


async def seed_data():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        from core.security import hash_password
        _seed_password = os.environ.get("SEED_DEFAULT_PASSWORD")
        if not _seed_password:
            print("ERROR: SEED_DEFAULT_PASSWORD env var is required.", file=sys.stderr)
            print("       Set a strong password before running seed:", file=sys.stderr)
            print("       SEED_DEFAULT_PASSWORD='<strong-password>' python seed.py", file=sys.stderr)
            sys.exit(1)
        _pw = hash_password(_seed_password)

        # 1. Organizations — 25 provinces + 3 ministries (28 total, real names)
        orgs = []
        for i, name in enumerate(PROVINCES):
            code = f"PRV{i+1:02d}"
            o = Organization(name_kh=name, type=instituteType.PROVINCE, code=code)
            session.add(o)
            orgs.append(o)
        for name, code in MINISTRIES:
            o = Organization(name_kh=name, type=instituteType.MINISTRY, code=code)
            session.add(o)
            orgs.append(o)
        await session.flush()

        # 2. Sports — 9 real Khmer sports
        sports = []
        for kh, en in SPORT_NAMES:
            s = Sport(name_kh=kh, sport_type=en)
            session.add(s)
            sports.append(s)
        await session.flush()

        # 3. One real national event (so registration can be tested)
        ev = Events(
            name_kh="កីឡាជាតិ ២០២៦",
            type=eventType.NATIONAL,
        )
        session.add(ev)
        await session.flush()

        # 4. Bootstrap accounts
        bootstrap = [
            dict(
                username="superadmin",
                email="superadmin@sport.gov.kh",
                role=UserRole.SUPER_ADMIN,
                kh_family_name="ហែម", kh_given_name="សុពណ៌",
                en_family_name="Hem", en_given_name="Sophorn",
                is_superuser=True,
                organization_id=None,
            ),
            dict(
                username="admin",
                email="admin@sport.gov.kh",
                role=UserRole.ADMIN,
                kh_family_name="សុខ", kh_given_name="ដារ៉ា",
                en_family_name="Sok", en_given_name="Dara",
                is_superuser=False,
                organization_id=None,
            ),
        ]
        for d in bootstrap:
            u = User(hashed_password=_pw, is_active=True, **d)
            session.add(u)

        # 5. Demo organization accounts — each linked to a real org
        for username, email, org_idx, kh_f, kh_g, en_f, en_g in DEMO_ORG_ACCOUNTS:
            u = User(
                username=username,
                email=email,
                hashed_password=_pw,
                role=UserRole.ORGANIZATION,
                kh_family_name=kh_f,
                kh_given_name=kh_g,
                en_family_name=en_f,
                en_given_name=en_g,
                is_active=True,
                is_superuser=False,
                organization_id=orgs[org_idx].id,
            )
            session.add(u)

        # 6. Demo federation accounts — each bound to a single sport
        for username, email, sport_idx, kh_f, kh_g, en_f, en_g in DEMO_FEDERATION_ACCOUNTS:
            u = User(
                username=username,
                email=email,
                hashed_password=_pw,
                role=UserRole.FEDERATION,
                kh_family_name=kh_f,
                kh_given_name=kh_g,
                en_family_name=en_f,
                en_given_name=en_g,
                is_active=True,
                is_superuser=False,
                organization_id=None,
                sport_id=sports[sport_idx].id,
            )
            session.add(u)

        await session.commit()
        print("Seeding completed successfully!")
        _pw_display = _seed_password
        print(f"\n--- DEMO CREDENTIALS (password: {_pw_display}) ---")
        print(f"superadmin / {_pw_display}  → super_admin")
        print(f"admin      / {_pw_display}  → admin")
        for username, _, org_idx, *_ in DEMO_ORG_ACCOUNTS:
            print(f"{username:<15} / {_pw_display}  → organization ({PROVINCES[org_idx] if org_idx < 25 else MINISTRIES[org_idx-25][0]})")
        for username, _, sport_idx, *_ in DEMO_FEDERATION_ACCOUNTS:
            print(f"{username:<15} / {_pw_display}  → federation ({SPORT_NAMES[sport_idx][0]})")


if __name__ == "__main__":
    asyncio.run(seed_data())
