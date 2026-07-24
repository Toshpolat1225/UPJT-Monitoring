from pydantic import BaseModel, UUID4, Field, ConfigDict
from datetime import datetime


# Base properties
class DepartmentBase(BaseModel):
    code: str = Field(..., max_length=50)
    name_uz: str = Field(..., max_length=255)
    is_total: bool = False
    company_id: UUID4 | None = None


# Properties to receive on creation
class DepartmentCreate(DepartmentBase):
    pass


# Properties to receive on update
class DepartmentUpdate(BaseModel):
    code: str | None = Field(None, max_length=50)
    name_uz: str | None = Field(None, max_length=255)
    is_total: bool | None = None
    company_id: UUID4 | None = None


# Properties to return to client
class DepartmentRead(DepartmentBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True
    )