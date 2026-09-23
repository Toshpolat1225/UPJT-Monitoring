import uuid
from sqlalchemy import Column, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from sqlalchemy.orm import relationship
from app.models.vehicle_fuel_type import vehicle_fuel_types


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    code = Column(Text, nullable=False)
    name_uz = Column(Text, nullable=False, default="")
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    fuel_type_id = Column(UUID(as_uuid=True), ForeignKey("fuel_types.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    allowed_fuel_types = relationship("FuelType", secondary=vehicle_fuel_types, lazy="selectin")

    @property
    def allowed_fuel_type_ids(self):
        allowed = self.allowed_fuel_types or []
        return [fuel.id for fuel in allowed] or [self.fuel_type_id]
