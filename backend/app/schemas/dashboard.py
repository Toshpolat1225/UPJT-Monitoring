import uuid
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict


class KPIMetricDTO(BaseModel):
    """Period uchun asosiy KPI ko'rsatkichlari."""
    limit: Decimal = Field(Decimal("0"), description="Calculated limit for the period")
    fact: Decimal = Field(Decimal("0"), description="Actual dispensed value")
    deviation: Decimal = Field(Decimal("0"), description="Difference between limit and fact")
    percentage: float = Field(0.0, description="Fact to limit percentage")
    remaining: Decimal = Field(Decimal("0"), description="Remaining limit")

    model_config = ConfigDict(from_attributes=True)


class OverallSummaryDTO(BaseModel):
    """Umumiy dashboard uchun agregatsiya qilingan KPI natijalari."""
    daily: KPIMetricDTO
    mtd: KPIMetricDTO
    opening_balance: Decimal = Field(Decimal("0"), description="First day opening balance")
    closing_balance: Decimal = Field(Decimal("0"), description="Last day closing balance")
    total_received: Decimal = Field(Decimal("0"), description="Total fuel received")
    total_transferred: Decimal = Field(Decimal("0"), description="Total fuel transferred")

    model_config = ConfigDict(from_attributes=True)


class DepartmentSummaryDTO(BaseModel):
    """Departamentlar kesimidagi jamlanmalar."""
    department_id: uuid.UUID
    department_name: str
    daily_fact: Decimal
    mtd_fact: Decimal
    monthly_limit: Decimal
    mtd_percentage: float

    model_config = ConfigDict(from_attributes=True)


class ChartDataPointDTO(BaseModel):
    """Kunlik grafiklar uchun vaqtli qatorlar (time-series) ma'lumoti."""
    entry_date: date
    total_dispensed: Decimal
    daily_limit: Decimal

    model_config = ConfigDict(from_attributes=True)


class DashboardAlertDTO(BaseModel):
    """Limitdan oshish bo'yicha ogohlantirishlar."""
    department_id: uuid.UUID
    department_name: str
    fuel_type_id: uuid.UUID
    fuel_type_name: str
    monthly_limit: Decimal
    mtd_fact: Decimal
    mtd_percentage: float
    severity: str = Field(..., description="'warning' (80-99%) or 'critical' (>=100%)")

    model_config = ConfigDict(from_attributes=True)