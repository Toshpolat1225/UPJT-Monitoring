from datetime import date
from decimal import Decimal
from pydantic import BaseModel, UUID4


class KPIMetricDTO(BaseModel):
    limit: Decimal
    fact: Decimal
    deviation: Decimal
    percentage: float
    remaining: Decimal


class OverallSummaryDTO(BaseModel):
    daily: KPIMetricDTO
    mtd: KPIMetricDTO
    opening_balance: Decimal
    closing_balance: Decimal
    total_received: Decimal
    total_transferred: Decimal


class DepartmentSummaryDTO(BaseModel):
    department_id: UUID4
    department_name: str
    daily_fact: Decimal
    mtd_fact: Decimal
    monthly_limit: Decimal
    mtd_percentage: float


class ChartDataPointDTO(BaseModel):
    entry_date: date
    total_dispensed: Decimal
    daily_limit: Decimal


class DashboardAlertDTO(BaseModel):
    department_id: UUID4
    department_name: str
    fuel_type_id: UUID4
    fuel_type_name: str
    monthly_limit: Decimal
    mtd_fact: Decimal
    mtd_percentage: float
    severity: str


class DashboardSummaryResponse(BaseModel):
    overall: OverallSummaryDTO
    departments: list[DepartmentSummaryDTO]
    chart: list[ChartDataPointDTO]
    alerts: list[DashboardAlertDTO]
