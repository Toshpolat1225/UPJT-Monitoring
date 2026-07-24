import uuid
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database.base import Base, AuditMixin


class FuelType(Base, AuditMixin):
    __tablename__ = "fuel_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name_uz: Mapped[str] = mapped_column(String(255), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, default="litr")

    # Relationships
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="fuel_type")
    fuel_matrix: Mapped[list["DepartmentFuelMatrix"]] = relationship(back_populates="fuel_type", cascade="all, delete-orphan")