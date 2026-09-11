from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4


class PermissionMatrixBase(BaseModel):
    role: str
    module: str
    permission: str
    allowed: bool = False


class PermissionMatrixCreate(PermissionMatrixBase):
    pass


class PermissionMatrixUpdate(BaseModel):
    allowed: bool | None = None


class PermissionMatrixRead(PermissionMatrixBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
