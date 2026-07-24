import uuid
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database.base import Base, AuditMixin


class Vehicle(Base, AuditMixin):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    name_uz: Mapped[str] = mapped_column(String(255), nullable=False)

    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id", ondelete="RESTRICT"))
    fuel_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fuel_types.id", ondelete="RESTRICT"))

    # Relationships
    department: Mapped["Department"] = relationship(back_populates="vehicles")
    fuel_type: Mapped["FuelType"] = relationship(back_populates="vehicles")
