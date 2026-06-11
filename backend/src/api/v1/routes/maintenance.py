from fastapi import APIRouter, Depends, status
from sqlalchemy import inspect, text

from core.database import Base, engine
from src.database.deps import require_admin
from src.models.user import User

router = APIRouter()


@router.post("/sync-schema", status_code=status.HTTP_200_OK)
async def sync_schema(
    checkfirst: bool = True,
    _: User = Depends(require_admin),
):
    """
    Synchronize the database schema by creating missing tables and adding
    required columns and indices.
    """

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=checkfirst)

        # Manually ensure sports.sport_type exists without altering existing rows.
        def _ensure_sport_type_column(sync_conn):
            inspector = inspect(sync_conn)
            columns = {col["name"] for col in inspector.get_columns("sports")}
            if "sport_type" not in columns:
                sync_conn.execute(
                    text(
                        "ALTER TABLE sports ADD COLUMN IF NOT EXISTS sport_type VARCHAR(100)"
                    )
                )

        def _ensure_org_sports_unique_index(sync_conn):
            sync_conn.execute(
                text(
                    """
CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_event_org_keys
ON sports_event_org (events_id, sports_id, organization_id)
WHERE events_id IS NOT NULL AND sports_id IS NOT NULL AND organization_id IS NOT NULL
                    """
                )
            )

        # Review FSM columns on participation_per_sport (added without touching rows;
        # existing rows default to SUBMITTED).
        def _ensure_participation_review_columns(sync_conn):
            sync_conn.execute(
                text(
                    "ALTER TABLE participation_per_sport "
                    "ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED'"
                )
            )
            sync_conn.execute(
                text(
                    "ALTER TABLE participation_per_sport "
                    "ADD COLUMN IF NOT EXISTS review_note TEXT"
                )
            )
            sync_conn.execute(
                text(
                    "ALTER TABLE participation_per_sport "
                    "ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP"
                )
            )

        await conn.run_sync(_ensure_sport_type_column)
        await conn.run_sync(_ensure_org_sports_unique_index)
        await conn.run_sync(_ensure_participation_review_columns)

    return {"detail": "Schema synchronized"}


@router.post("/drop", status_code=status.HTTP_200_OK)
async def drop_schema(_: User = Depends(require_admin)):
    """
    Drop all tables for a full reset.
    WARNING: Irreversible—removes all data.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    return {"detail": "All tables dropped"}
