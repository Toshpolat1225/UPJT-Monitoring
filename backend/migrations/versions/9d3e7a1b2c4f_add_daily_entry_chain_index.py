"""Index daily entry chain ordering queries."""

from alembic import op


revision = "9d3e7a1b2c4f"
down_revision = "8a2f4b6c1d90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_daily_entries_chain_order",
        "daily_entries",
        ["vehicle_id", "fuel_type_id", "entry_date", "created_at", "id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_daily_entries_chain_order", table_name="daily_entries")
