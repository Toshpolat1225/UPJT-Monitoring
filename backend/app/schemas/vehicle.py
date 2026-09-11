from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4


class VehicleBase(BaseModel):
    code: str
    name_uz: str
    department_id: UUID4
    fuel_type_id: UUID4


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    code: str | None = None
    name_uz: str | None = None
    department_id: UUID4 | None = None
    fuel_type_id: UUID4 | None = None


class VehicleRead(VehicleBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
