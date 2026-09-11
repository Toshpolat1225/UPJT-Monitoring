from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4


class FuelTypeBase(BaseModel):
    code: str
    name_uz: str
    unit: str = "litr"


class FuelTypeCreate(FuelTypeBase):
    pass


class FuelTypeUpdate(BaseModel):
    code: str | None = None
    name_uz: str | None = None
    unit: str | None = None


class FuelTypeRead(FuelTypeBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
