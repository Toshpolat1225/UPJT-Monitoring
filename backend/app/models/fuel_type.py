from sqlalchemy import Column, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, ENUM
from app.core.database import Base
from app.models.enums import FuelUnit


class FuelType(Base):
    __tablename__ = "fuel_types"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    name_uz = Column(Text, nullable=False, default="")
    name_ru = Column(Text, nullable=False, default="")
    unit = Column(ENUM(FuelUnit, name="fuel_unit", create_type=False), nullable=False, default=FuelUnit.litr)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
