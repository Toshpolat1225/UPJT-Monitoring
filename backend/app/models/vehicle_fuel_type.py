from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


vehicle_fuel_types = Table(
    "vehicle_fuel_types",
    Base.metadata,
    Column("vehicle_id", UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), primary_key=True),
    Column("fuel_type_id", UUID(as_uuid=True), ForeignKey("fuel_types.id", ondelete="CASCADE"), primary_key=True),
)