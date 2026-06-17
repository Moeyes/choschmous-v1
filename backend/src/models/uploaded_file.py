from sqlalchemy import String, Integer, DateTime, func, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from core.database import Base


class UploadedFile(Base):
    """Binary file storage, keyed by a UUID.

    Stores the raw bytes of uploaded files (athlete photos, ID documents)
    directly in the database. The primary key is a UUID that doubles as the
    file's unique name, so a file is located and served purely by its id
    (``GET /api/files/{id}``). Contents are Restricted-PII — retrieval is
    auth-protected at the route layer.
    """

    __tablename__ = "uploaded_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Unique id; also the file's stored name used for lookup",
    )

    filename: Mapped[str | None] = mapped_column(
        String(255), nullable=True, comment="Original client filename (informational)"
    )

    content_type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="MIME type, e.g. image/png"
    )

    size: Mapped[int] = mapped_column(Integer, nullable=False, comment="Size in bytes")

    data: Mapped[bytes] = mapped_column(
        LargeBinary, nullable=False, comment="Raw file bytes"
    )

    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, comment="User id that uploaded the file"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
