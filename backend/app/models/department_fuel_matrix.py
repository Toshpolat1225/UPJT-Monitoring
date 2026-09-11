from sqlalchemy import Boolean, Column, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class DepartmentFuelMatrix(Base):
    __tablename__ = "department_fuel_matrix"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    fuel_type_id = Column(UUID(as_uuid=True), ForeignKey("fuel_types.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
