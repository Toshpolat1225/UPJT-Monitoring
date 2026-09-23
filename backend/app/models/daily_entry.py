import uuid
from sqlalchemy import Column, Date, Numeric, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class DailyEntry(Base):
    __tablename__ = "daily_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    entry_date = Column(Date, nullable=False)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    section_id = Column(UUID(as_uuid=True), ForeignKey("sections.id", ondelete="SET NULL"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="RESTRICT"), nullable=False)
    fuel_type_id = Column(UUID(as_uuid=True), ForeignKey("fuel_types.id", ondelete="RESTRICT"), nullable=False)
    opening_balance = Column(Numeric(14, 2), nullable=False, default=0)
    received_azs = Column(Numeric(14, 2), nullable=False, default=0)
    transfer_in = Column(Numeric(14, 2), nullable=False, default=0)
    transfer_out = Column(Numeric(14, 2), nullable=False, default=0)
    consumption = Column(Numeric(14, 2), nullable=False, default=0)
    closing_balance = Column(Numeric(14, 2), nullable=False, default=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Reference data is eagerly loaded so the API response carries the real
    # texnika / sex / bo'lim / yoqilg'i turi rows instead of bare foreign keys.
    vehicle = relationship("Vehicle", lazy="selectin")
    department = relationship("Department", lazy="selectin")
    section = relationship("Section", lazy="selectin")
    fuel_type = relationship("FuelType", lazy="selectin")
