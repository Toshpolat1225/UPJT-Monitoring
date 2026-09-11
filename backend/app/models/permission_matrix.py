import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PermissionMatrix(Base):
    __tablename__ = "permission_matrix"
    __table_args__ = (
        UniqueConstraint("role", "module", "permission", name="uq_permission_matrix"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    permission: Mapped[str] = mapped_column(String(100), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
