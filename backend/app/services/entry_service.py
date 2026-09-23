"""Balance-chain rules for daily entries.

The opening balance ("Boshlang'ich qoldiq") is derived from the previous
entry's closing balance and is never trusted from the client, and the "latest
entry" is resolved by business date plus creation timestamp - never by the
largest id, which is not chronological.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session, lazyload
from sqlalchemy import text

from app.models.daily_entry import DailyEntry
from app.services.aggregation import compute_closing_balance, to_decimal

__all__ = [
    "lock_chain",
    "find_latest_entry",
    "resolve_opening_balance",
    "recalculate_following_balances",
    "compute_closing_balance",
]


def lock_chain(db: Session, vehicle_id, fuel_type_id) -> None:
    """Serialize mutations for one transport/fuel ledger chain."""
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:chain_key))"),
        {"chain_key": f"daily-entry:{vehicle_id}:{fuel_type_id}"},
    )


def lock_chains(db: Session, chains) -> None:
    """Lock one or more chains in a stable order to avoid deadlocks."""
    for vehicle_id, fuel_type_id in sorted({(str(vehicle), str(fuel)) for vehicle, fuel in chains}):
        lock_chain(db, vehicle_id, fuel_type_id)


def find_latest_entry(
    db: Session,
    vehicle_id,
    fuel_type_id,
    before_date: date,
    exclude_id=None,
) -> Optional[DailyEntry]:
    """Most recent entry for a vehicle + fuel type strictly before ``before_date``.

    Several entries can share one business date, so ``created_at`` breaks the
    tie. Ordering never relies on the primary key.
    """
    query = db.query(DailyEntry).filter(
        DailyEntry.vehicle_id == vehicle_id,
        DailyEntry.fuel_type_id == fuel_type_id,
        DailyEntry.entry_date <= before_date,
    )
    if exclude_id is not None:
        query = query.filter(DailyEntry.id != exclude_id)
    return query.order_by(
        DailyEntry.entry_date.desc(),
        DailyEntry.created_at.desc(),
        DailyEntry.id.desc(),
    ).first()


def resolve_opening_balance(
    db: Session,
    vehicle_id,
    fuel_type_id,
    entry_date: date,
    requested,
    exclude_id=None,
    before_created_at: Optional[datetime] = None,
) -> Decimal:
    """Opening balance for an entry.

    The previous entry's closing balance is authoritative. Only the very first
    entry of a vehicle + fuel type falls back to the balance supplied by the
    caller.
    """
    query = db.query(DailyEntry).filter(
        DailyEntry.vehicle_id == vehicle_id,
        DailyEntry.fuel_type_id == fuel_type_id,
    )
    if before_created_at is None:
        query = query.filter(DailyEntry.entry_date <= entry_date)
    else:
        query = query.filter(
            (DailyEntry.entry_date < entry_date)
            | ((DailyEntry.entry_date == entry_date) & (DailyEntry.created_at < before_created_at))
        )
    if exclude_id is not None:
        query = query.filter(DailyEntry.id != exclude_id)
    previous = query.order_by(
        DailyEntry.entry_date.desc(),
        DailyEntry.created_at.desc(),
        DailyEntry.id.desc(),
    ).first()
    if previous is not None:
        return to_decimal(previous.closing_balance)
    return to_decimal(requested)


def recalculate_following_balances(
    db: Session,
    vehicle_id,
    fuel_type_id,
    from_date: date,
) -> None:
    """Keep the balance chain server-authoritative after a changed entry."""
    lock_chain(db, vehicle_id, fuel_type_id)
    previous = db.query(DailyEntry).filter(
        DailyEntry.vehicle_id == vehicle_id,
        DailyEntry.fuel_type_id == fuel_type_id,
        DailyEntry.entry_date < from_date,
    ).options(
        lazyload(DailyEntry.vehicle),
        lazyload(DailyEntry.department),
        lazyload(DailyEntry.section),
        lazyload(DailyEntry.fuel_type),
    ).order_by(
        DailyEntry.entry_date.desc(),
        DailyEntry.created_at.desc(),
        DailyEntry.id.desc(),
    ).with_for_update().first()
    previous_closing = to_decimal(previous.closing_balance) if previous else None
    rows = (
        db.query(DailyEntry)
        .filter(
            DailyEntry.vehicle_id == vehicle_id,
            DailyEntry.fuel_type_id == fuel_type_id,
            DailyEntry.entry_date >= from_date,
        )
        .options(
            lazyload(DailyEntry.vehicle),
            lazyload(DailyEntry.department),
            lazyload(DailyEntry.section),
            lazyload(DailyEntry.fuel_type),
        )
        .order_by(DailyEntry.entry_date.asc(), DailyEntry.created_at.asc(), DailyEntry.id.asc())
        .with_for_update()
        .all()
    )
    for row in rows:
        if previous_closing is not None:
            row.opening_balance = previous_closing
        row.closing_balance = compute_closing_balance(
            row.opening_balance,
            row.received_azs,
            row.transfer_in,
            row.transfer_out,
            row.consumption,
        )
        if row.closing_balance < 0:
            raise ValueError("Operation would create a negative balance")
        previous_closing = to_decimal(row.closing_balance)
