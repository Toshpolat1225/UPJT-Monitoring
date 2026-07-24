import uuid
from sqlalchemy import ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database.base import Base, AuditMixin


class DepartmentFuelMatrix(Base, AuditMixin):
    __tablename__ = "department_fuel_matrix"
    __table_args__ = (UniqueConstraint('department_id', 'fuel_type_id', name='uq_department_fuel_type'),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"))
    fuel_type_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fuel_types.id", ondelete="CASCADE"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    department: Mapped["Department"] = relationship(back_populates="fuel_matrix")
    fuel_type: Mapped["FuelType"] = relationship(back_populates="fuel_matrix")