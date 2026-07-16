from sqlalchemy import Column, Text, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, ENUM
from app.core.database import Base
from app.models.enums import AppRole


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    role = Column(ENUM(AppRole, name="app_role", create_type=False), nullable=False)
    module = Column(Text, nullable=False)
    permission = Column(Text, nullable=False)
    allowed = Column(Boolean, nullable=False, default=False)
