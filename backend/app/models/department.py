import uuid
from sqlalchemy import String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database.base import Base, AuditMixin


class Department(Base, AuditMixin):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name_uz: Mapped[str] = mapped_column(String(255), nullable=False)
    is_total: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    company_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"))

    # Relationships
    company: Mapped["Company"] = relationship(back_populates="departments")
    sections: Mapped[list["Section"]] = relationship(back_populates="department", cascade="all, delete-orphan")
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="department", cascade="all, delete-orphan")
    fuel_matrix: Mapped[list["DepartmentFuelMatrix"]] = relationship(back_populates="department", cascade="all, delete-orphan")
