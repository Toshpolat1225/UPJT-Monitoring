from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, UUID4


class MonthlyLimitBase(BaseModel):
    department_id: UUID4
    section_id: UUID4 | None = None
    fuel_type_id: UUID4
    year: int
    month: int = Field(ge=1, le=12)
    limit_value: Decimal = Field(default=Decimal("0"), ge=0)


class MonthlyLimitCreate(MonthlyLimitBase):
    pass


class MonthlyLimitUpdate(BaseModel):
    department_id: UUID4 | None = None
    section_id: UUID4 | None = None
    fuel_type_id: UUID4 | None = None
    year: int | None = None
    month: int | None = Field(default=None, ge=1, le=12)
    limit_value: Decimal | None = Field(default=None, ge=0)


class MonthlyLimitRead(MonthlyLimitBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
