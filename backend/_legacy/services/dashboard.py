import uuid
from datetime import date
from typing import Annotated
from fastapi import APIRouter, Depends, Query

from app.dependencies.permissions import RequirePermission
from app.schemas.dashboard import (
    OverallSummaryDTO,
    DepartmentSummaryDTO,
    ChartDataPointDTO,
    DashboardAlertDTO,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=OverallSummaryDTO,
    dependencies=[Depends(RequirePermission("dashboard.read"))],
)
async def get_dashboard_summary(
    service: Annotated[DashboardService, Depends()],
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month),
    company_id: uuid.UUID | None = Query(None),
    department_id: uuid.UUID | None = Query(None),
):
    """Main dashboard KPI summary including Daily, MTD, balances, and totals."""
    return await service.get_overall_summary(year, month, company_id, department_id)


@router.get(
    "/departments",
    response_model=list[DepartmentSummaryDTO],
    dependencies=[Depends(RequirePermission("dashboard.read"))],
)
async def get_department_breakdown(
    service: Annotated[DashboardService, Depends()],
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month),
    company_id: uuid.UUID | None = Query(None),
):
    """Department-wise aggregation breakdown for MTD limit vs actual consumption."""
    return await service.get_department_breakdown(year, month, company_id)


@router.get(
    "/charts/daily-dispense",
    response_model=list[ChartDataPointDTO],
    dependencies=[Depends(RequirePermission("dashboard.read"))],
)
async def get_daily_dispense_chart(
    service: Annotated[DashboardService, Depends()],
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month),
    company_id: uuid.UUID | None = Query(None),
    department_id: uuid.UUID | None = Query(None),
):
    """Daily time-series data for rendering daily dispense vs daily limit charts."""
    return await service.get_daily_chart_data(year, month, company_id, department_id)


@router.get(
    "/alerts",
    response_model=list[DashboardAlertDTO],
    dependencies=[Depends(RequirePermission("dashboard.read"))],
)
async def get_dashboard_alerts(
    service: Annotated[DashboardService, Depends()],
    year: int = Query(default_factory=lambda: date.today().year),
    month: int = Query(default_factory=lambda: date.today().month),
    threshold: float = Query(80.0, ge=0.0, le=200.0, description="Threshold percentage (default: 80%)"),
    company_id: uuid.UUID | None = Query(None),
):
    """List departments exceeding threshold limits (e.g., >80% warning or >=100% critical)."""
    return await service.get_limit_alerts(year, month, company_id, threshold)