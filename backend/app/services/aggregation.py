"""Canonical fuel aggregation - the single source of truth for limit/fact totals.

The Kunlik kiritish table, the Excel export and the dashboard must produce the
same numbers for the same period. Every consumer goes through the helpers below
so the pro-rating formula, the fuel grouping key and the division-by-zero
policy exist in exactly one place.
"""

from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Iterable, List, Sequence, Tuple

TWO_PLACES = Decimal("0.01")


def to_decimal(value) -> Decimal:
    """Coerce ``value`` (None | int | float | str | Decimal) to Decimal."""
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def quantize(value) -> Decimal:
    """Round to 2 decimals - the precision the database stores."""
    return to_decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def unit_code(unit) -> str:
    """Normalise a fuel unit (enum or plain string) to its code."""
    return getattr(unit, "value", unit) or "litr"


def days_in_month(year: int, month: int) -> int:
    return monthrange(year, month)[1]


def month_bounds(year: int, month: int) -> Tuple[date, date]:
    return date(year, month, 1), date(year, month, days_in_month(year, month))


def days_in_month_within_range(start: date, end: date, year: int, month: int) -> int:
    """Calendar days of [start, end] that fall inside the given month."""
    month_start, month_end = month_bounds(year, month)
    low = max(start, month_start)
    high = min(end, month_end)
    if high < low:
        return 0
    return (high - low).days + 1


def prorated_limit(monthly_limit, year: int, month: int, start: date, end: date) -> Decimal:
    """Pro-rate a monthly limit over the calendar days of the selected range."""
    total_days = days_in_month(year, month)
    if total_days <= 0:
        return Decimal("0")
    selected_days = days_in_month_within_range(start, end, year, month)
    if selected_days <= 0:
        return Decimal("0")
    return (to_decimal(monthly_limit) / Decimal(total_days)) * Decimal(selected_days)


def safe_percentage(fact, limit) -> float:
    """``fact / limit * 100``; ``0.0`` when there is no positive baseline.

    A zero or missing limit must never yield a huge, meaningless percentage
    (or a ZeroDivisionError).
    """
    baseline = to_decimal(limit)
    if baseline <= 0:
        return 0.0
    return float((to_decimal(fact) / baseline) * Decimal("100"))


def compute_closing_balance(opening, received_azs, transfer_in, transfer_out, consumption) -> Decimal:
    """Authoritative closing balance for an entry."""
    return (
        to_decimal(opening)
        + to_decimal(received_azs)
        + to_decimal(transfer_in)
        - to_decimal(transfer_out)
        - to_decimal(consumption)
    )


def monthly_limits_by_fuel(limits: Iterable) -> Dict[str, Decimal]:
    """Sum every monthly limit row per fuel type.

    Department-level and section-level rows are both included: a limit defined
    for a section is part of the department's (and the plant's) monthly limit.
    """
    totals: Dict[str, Decimal] = {}
    for limit in limits:
        key = str(limit.fuel_type_id)
        totals[key] = totals.get(key, Decimal("0")) + to_decimal(limit.limit_value)
    return totals


def facts_by_fuel(entries: Iterable) -> Dict[str, Decimal]:
    """Sum ``consumption`` per fuel type."""
    totals: Dict[str, Decimal] = {}
    for entry in entries:
        key = str(entry.fuel_type_id)
        totals[key] = totals.get(key, Decimal("0")) + to_decimal(entry.consumption)
    return totals


def build_fuel_totals(
    fuel_types: Sequence,
    limits: Iterable,
    entries: Iterable,
    start: date,
    end: date,
) -> dict:
    """Canonical per-fuel totals for the period [start, end].

    Fuel types that have no entries in the period still produce a row with
    ``fact = 0`` and ``limit = <pro-rated limit>`` - never a random or stale
    value, and never ``None``.
    """
    year, month = start.year, start.month
    limit_by_fuel = monthly_limits_by_fuel(limits)
    fact_by_fuel = facts_by_fuel(entries)

    per_fuel: List[dict] = []
    for fuel_type in fuel_types:
        fuel_id = str(fuel_type.id)
        limit = prorated_limit(limit_by_fuel.get(fuel_id, Decimal("0")), year, month, start, end)
        fact = fact_by_fuel.get(fuel_id, Decimal("0"))
        per_fuel.append(
            {
                "fuel_type_id": fuel_id,
                "fuel_type_code": fuel_type.code,
                "fuel_type_name": fuel_type.name_uz,
                "unit": unit_code(fuel_type.unit),
                "limit": quantize(limit),
                "fact": quantize(fact),
                "saved": quantize(limit - fact),
                "percentage": safe_percentage(fact, limit),
            }
        )

    grand_limit = sum((row["limit"] for row in per_fuel), Decimal("0"))
    grand_fact = sum((row["fact"] for row in per_fuel), Decimal("0"))

    return {
        "period_from": start,
        "period_to": end,
        "days_in_month": days_in_month(year, month),
        "days_in_period": days_in_month_within_range(start, end, year, month),
        "per_fuel": per_fuel,
        "grand": {
            "limit": quantize(grand_limit),
            "fact": quantize(grand_fact),
            "saved": quantize(grand_limit - grand_fact),
            "percentage": safe_percentage(grand_fact, grand_limit),
        },
    }
