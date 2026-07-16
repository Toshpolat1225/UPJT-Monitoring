from sqlalchemy import Column, Date, Numeric, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class DailyEntry(Base):
    __tablename__ = "daily_entries"
    __table_args__ = (
        UniqueConstraint("entry_date", "vehicle_id", "fuel_type_id", name="uq_daily_entries_date_vehicle_fuel"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
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
    created_by = Column(UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
