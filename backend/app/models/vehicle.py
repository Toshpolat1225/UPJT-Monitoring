from sqlalchemy import Column, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    name_uz = Column(Text, nullable=False, default="")
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    fuel_type_id = Column(UUID(as_uuid=True), ForeignKey("fuel_types.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
