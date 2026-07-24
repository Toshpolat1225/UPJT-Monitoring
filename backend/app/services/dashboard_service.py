import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.dashboard_repository import DashboardRepository
from app.schemas.dashboard import (
    OverallSummaryDTO,
    KPIMetricDTO,
    DepartmentSummaryDTO,
    ChartDataPointDTO,
    DashboardAlertDTO,
)


class DashboardService:
    def __init__(self, db_session: AsyncSession):
        self.repo = DashboardRepository(db_session)

    async def get_overall_summary(
        self,
        year: int,
        month: int,
        company_id: uuid.UUID | None,
        department_id: uuid.UUID | None,
    ) -> OverallSummaryDTO:
        data = await self.repo.get_overall_summary(year, month, company_id, department_id)

        if not data:
            return OverallSummaryDTO(
                daily=KPIMetricDTO(),
                mtd=KPIMetricDTO(),
                opening_balance=Decimal("0"),
                closing_balance=Decimal("0"),
                total_received=Decimal("0"),
                total_transferred=Decimal("0"),
            )

        daily_limit = Decimal(str(data.get("daily_limit", 0)))
        daily_fact = Decimal(str(data.get("daily_fact", 0)))
        monthly_limit = Decimal(str(data.get("monthly_limit", 0)))
        mtd_fact = Decimal(str(data.get("mtd_fact", 0)))

        daily_kpi = KPIMetricDTO(
            limit=daily_limit,
            fact=daily_fact,
            deviation=daily_limit - daily_fact,
            percentage=float((daily_fact / daily_limit * 100) if daily_limit > 0 else 0),
            remaining=max(Decimal("0"), daily_limit - daily_fact),
        )

        mtd_kpi = KPIMetricDTO(
            limit=monthly_limit,
            fact=mtd_fact,
            deviation=monthly_limit - mtd_fact,
            percentage=data.get("mtd_percentage", 0.0),
            remaining=Decimal(str(data.get("remaining_limit", 0))),
        )

        return OverallSummaryDTO(
            daily=daily_kpi,
            mtd=mtd_kpi,
            opening_balance=Decimal(str(data.get("opening_balance", 0))),
            closing_balance=Decimal(str(data.get("closing_balance", 0))),
            total_received=Decimal(str(data.get("total_received", 0))),
            total_transferred=Decimal(str(data.get("total_transferred", 0))),
        )

    async def get_department_breakdown(
        self, year: int, month: int, company_id: uuid.UUID | None
    ) -> list[DepartmentSummaryDTO]:
        raw_data = await self.repo.get_department_breakdown(year, month, company_id)
        return [DepartmentSummaryDTO.model_validate(row) for row in raw_data]

    async def get_daily_chart_data(
        self,
        year: int,
        month: int,
        company_id: uuid.UUID | None,
        department_id: uuid.UUID | None,
    ) -> list[ChartDataPointDTO]:
        raw_data = await self.repo.get_daily_chart_data(year, month, company_id, department_id)
        return [ChartDataPointDTO.model_validate(row) for row in raw_data]

    async def get_limit_alerts(
        self,
        year: int,
        month: int,
        company_id: uuid.UUID | None,
        threshold: float,
    ) -> list[DashboardAlertDTO]:
        raw_data = await self.repo.get_limit_alerts(year, month, company_id, threshold)
        return [DashboardAlertDTO.model_validate(row) for row in raw_data]