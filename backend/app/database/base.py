import re
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, declared_attr, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    """Base for all models."""

    __abstract__ = True

    @declared_attr.directive
    def __tablename__(cls) -> str:
        # Converts CamelCase to snake_case and pluralizes
        return re.sub(r'(?<!^)(?=[A-Z])', '_', cls.__name__).lower() + "s"


class AuditMixin:
    """
    Mixin for audit fields, including soft delete.
    """
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    updated_by: Mapped["User"] = relationship(foreign_keys=[updated_by_id])