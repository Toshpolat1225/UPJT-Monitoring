from datetime import datetime
from pydantic import BaseModel, ConfigDict, UUID4


class DepartmentBase(BaseModel):
    code: str
    name_uz: str
    is_total: bool = False
    company_id: UUID4 | None = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    code: str | None = None
    name_uz: str | None = None
    is_total: bool | None = None
    company_id: UUID4 | None = None


class DepartmentRead(DepartmentBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
