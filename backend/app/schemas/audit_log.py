from datetime import datetime

from pydantic import BaseModel, ConfigDict, UUID4


class AuditLogRead(BaseModel):
    id: UUID4
    user_id: UUID4 | None = None
    action: str
    table_name: str
    row_id: UUID4 | None = None
    details: dict | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
