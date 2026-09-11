"""Business services shared by the API routers."""

from app.services.aggregation import (
    build_fuel_totals,
    compute_closing_balance,
    days_in_month,
    days_in_month_within_range,
    facts_by_fuel,
    month_bounds,
    monthly_limits_by_fuel,
    prorated_limit,
    quantize,
    safe_percentage,
    to_decimal,
)
from app.services.entry_service import (
    compute_closing_balance as compute_entry_closing_balance,
    find_latest_entry,
    resolve_opening_balance,
)

__all__ = [
    "build_fuel_totals",
    "compute_closing_balance",
    "compute_entry_closing_balance",
    "days_in_month",
    "days_in_month_within_range",
    "facts_by_fuel",
    "find_latest_entry",
    "month_bounds",
    "monthly_limits_by_fuel",
    "prorated_limit",
    "quantize",
    "resolve_opening_balance",
    "safe_percentage",
    "to_decimal",
]
