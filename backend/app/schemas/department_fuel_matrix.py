from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4


class DepartmentFuelMatrixBase(BaseModel):
    department_id: UUID4
    fuel_type_id: UUID4
    is_active: bool = True


class DepartmentFuelMatrixCreate(DepartmentFuelMatrixBase):
    pass


class DepartmentFuelMatrixRead(DepartmentFuelMatrixBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
