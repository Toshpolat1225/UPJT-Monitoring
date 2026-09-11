from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4


class CompanyBase(BaseModel):
    short_name: str
    full_name: str


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    short_name: str | None = None
    full_name: str | None = None


class CompanyRead(CompanyBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
