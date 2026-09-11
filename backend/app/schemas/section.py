from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4


class SectionBase(BaseModel):
    department_id: UUID4
    name: str
    name_uz: str


class SectionCreate(SectionBase):
    pass


class SectionUpdate(BaseModel):
    department_id: UUID4 | None = None
    name: str | None = None
    name_uz: str | None = None


class SectionRead(SectionBase):
    id: UUID4
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
