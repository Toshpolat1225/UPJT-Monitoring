from sqlalchemy import Column, Text, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code = Column(Text, nullable=False, unique=True)
    name = Column(Text, nullable=False)
    name_uz = Column(Text, nullable=False, default="")
    is_total = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
