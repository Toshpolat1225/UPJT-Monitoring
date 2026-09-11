from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Dict, List, Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.daily_entry import DailyEntry
from app.models.department import Department
from app.models.fuel_type import FuelType
from app.models.monthly_limit import MonthlyLimit
from app.models.user import Profile
from app.schemas.dashboard import (
    ChartDataPointDTO,
    DashboardAlertDTO,
    DashboardSummaryResponse,
    DepartmentSummaryDTO,
    KPIMetricDTO,
    OverallSummaryDTO,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _as_decimal(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    today = date.today()
    year = today.year
    month = today.month
    days_in_month = monthrange(year, month)[1]
    start_of_month = date(year, month, 1)
    end_of_month = date(year, month, days_in_month)

    departments = db.query(Department).all()
    fuel_types = db.query(FuelType).all()
    department_lookup = {str(department.id): department.name_uz for department in departments}
    fuel_type_lookup = {str(fuel_type.id): fuel_type.name_uz for fuel_type in fuel_types}

    limits = (
        db.query(MonthlyLimit)
        .filter(MonthlyLimit.year == year, MonthlyLimit.month == month)
        .all()
    )
    entries = (
        db.query(DailyEntry)
        .filter(DailyEntry.entry_date >= start_of_month, DailyEntry.entry_date <= end_of_month)
        .all()
    )

    monthly_limits_by_pair: Dict[Tuple[str, str], Decimal] = {}
    for limit_row in limits:
        key = (str(limit_row.department_id), str(limit_row.fuel_type_id))
        monthly_limits_by_pair[key] = monthly_limits_by_pair.get(key, Decimal("0")) + _as_decimal(limit_row.limit_value)

    month_entry_totals_by_pair: Dict[Tuple[str, str], Decimal] = {}
    day_entry_totals_by_pair: Dict[Tuple[str, str], Decimal] = {}
    daily_entries_by_date: Dict[date, Decimal] = {}

    for entry in entries:
        pair_key = (str(entry.department_id), str(entry.fuel_type_id))
        entry_consumption = _as_decimal(entry.consumption)
        month_entry_totals_by_pair[pair_key] = month_entry_totals_by_pair.get(pair_key, Decimal("0")) + entry_consumption

        if entry.entry_date == today:
            day_entry_totals_by_pair[pair_key] = day_entry_totals_by_pair.get(pair_key, Decimal("0")) + entry_consumption

        daily_entries_by_date[entry.entry_date] = daily_entries_by_date.get(entry.entry_date, Decimal("0")) + entry_consumption

    all_pair_keys = set(monthly_limits_by_pair.keys()) | set(month_entry_totals_by_pair.keys())

    total_monthly_limit = sum(monthly_limits_by_pair.values(), Decimal("0"))
    total_monthly_fact = sum(month_entry_totals_by_pair.values(), Decimal("0"))
    total_daily_fact = daily_entries_by_date.get(today, Decimal("0"))
    daily_limit_per_day = total_monthly_limit / Decimal(days_in_month) if total_monthly_limit else Decimal("0")

    def pct(numerator: Decimal, denominator: Decimal) -> float:
        if denominator == 0:
            return 0.0
        return float((numerator / denominator) * Decimal("100"))

    daily_metric = KPIMetricDTO(
        limit=daily_limit_per_day,
        fact=total_daily_fact,
        deviation=daily_limit_per_day - total_daily_fact,
        percentage=pct(total_daily_fact, daily_limit_per_day),
        remaining=daily_limit_per_day - total_daily_fact,
    )

    mtd_metric = KPIMetricDTO(
        limit=total_monthly_limit,
        fact=total_monthly_fact,
        deviation=total_monthly_limit - total_monthly_fact,
        percentage=pct(total_monthly_fact, total_monthly_limit),
        remaining=total_monthly_limit - total_monthly_fact,
    )

    overall = OverallSummaryDTO(
        daily=daily_metric,
        mtd=mtd_metric,
        opening_balance=sum((_as_decimal(entry.opening_balance) for entry in entries), Decimal("0")),
        closing_balance=sum((_as_decimal(entry.closing_balance) for entry in entries), Decimal("0")),
        total_received=sum((_as_decimal(entry.received_azs) for entry in entries), Decimal("0")),
        total_transferred=sum(
            (_as_decimal(entry.transfer_in) + _as_decimal(entry.transfer_out) for entry in entries),
            Decimal("0"),
        ),
    )

    department_rows: List[DepartmentSummaryDTO] = []
    for department in departments:
        department_id = str(department.id)
        for fuel_type in fuel_types:
            fuel_type_id = str(fuel_type.id)
            pair_key = (department_id, fuel_type_id)
            if pair_key not in all_pair_keys:
                continue

            monthly_limit = monthly_limits_by_pair.get(pair_key, Decimal("0"))
            daily_fact = day_entry_totals_by_pair.get(pair_key, Decimal("0"))
            mtd_fact = month_entry_totals_by_pair.get(pair_key, Decimal("0"))

            department_rows.append(
                DepartmentSummaryDTO(
                    department_id=department.id,
                    department_name=department.name_uz,
                    daily_fact=daily_fact,
                    mtd_fact=mtd_fact,
                    monthly_limit=monthly_limit,
                    mtd_percentage=pct(mtd_fact, monthly_limit),
                )
            )

    alert_rows: List[DashboardAlertDTO] = []
    for department in departments:
        department_id = str(department.id)
        for fuel_type in fuel_types:
            fuel_type_id = str(fuel_type.id)
            pair_key = (department_id, fuel_type_id)
            monthly_limit = monthly_limits_by_pair.get(pair_key, Decimal("0"))
            mtd_fact = month_entry_totals_by_pair.get(pair_key, Decimal("0"))

            if monthly_limit == Decimal("0") and mtd_fact == Decimal("0"):
                continue

            percentage = pct(mtd_fact, monthly_limit)
            if percentage < 80:
                continue

            alert_rows.append(
                DashboardAlertDTO(
                    department_id=department.id,
                    department_name=department.name_uz,
                    fuel_type_id=fuel_type.id,
                    fuel_type_name=fuel_type.name_uz,
                    monthly_limit=monthly_limit,
                    mtd_fact=mtd_fact,
                    mtd_percentage=percentage,
                    severity="critical" if percentage >= 100 else "warning",
                )
            )

    chart_rows: List[ChartDataPointDTO] = []
    for day in range(1, days_in_month + 1):
        chart_date = date(year, month, day)
        chart_rows.append(
            ChartDataPointDTO(
                entry_date=chart_date,
                total_dispensed=daily_entries_by_date.get(chart_date, Decimal("0")),
                daily_limit=daily_limit_per_day,
            )
        )

    return DashboardSummaryResponse(
        overall=overall,
        departments=department_rows,
        chart=chart_rows,
        alerts=alert_rows,
    )
