"""Allow multiple same-day ledger events and vehicle fuel permissions."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "8a2f4b6c1d90"
down_revision = "4fdd25f7780e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_daily_entries_date_vehicle_fuel", "daily_entries", type_="unique")
    op.create_table(
        "vehicle_fuel_types",
        sa.Column("vehicle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fuel_type_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["vehicle_id"], ["vehicles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["fuel_type_id"], ["fuel_types.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("vehicle_id", "fuel_type_id"),
    )
    op.execute("INSERT INTO vehicle_fuel_types (vehicle_id, fuel_type_id) SELECT id, fuel_type_id FROM vehicles")


def downgrade() -> None:
    op.drop_table("vehicle_fuel_types")
    op.create_unique_constraint(
        "uq_daily_entries_date_vehicle_fuel",
        "daily_entries",
        ["entry_date", "vehicle_id", "fuel_type_id"],
    )
