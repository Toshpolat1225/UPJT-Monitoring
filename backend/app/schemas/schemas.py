from pydantic import BaseModel, EmailStr, UUID4
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""
    department_id: Optional[str] = None
    company_id: Optional[str] = None
    roles: List[str] = []


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department_id: Optional[str] = None
    company_id: Optional[str] = None
    roles: Optional[List[str]] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]
    department_id: Optional[str]
    company_id: Optional[str]
    roles: List[str] = []
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserPasswordReset(BaseModel):
    password: str


class UserStatusUpdate(BaseModel):
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str
    user: ProfileResponse


# ---- Departments ----
class DepartmentCreate(BaseModel):
    code: str
    name_uz: str
    is_total: bool = False


class DepartmentUpdate(BaseModel):
    code: Optional[str] = None
    name_uz: Optional[str] = None
    is_total: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: str
    code: str
    name: str
    name_uz: str
    is_total: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Sections ----
class SectionCreate(BaseModel):
    department_id: str
    name_uz: str


class SectionUpdate(BaseModel):
    department_id: Optional[str] = None
    name_uz: Optional[str] = None


class SectionResponse(BaseModel):
    id: str
    department_id: str
    name: str
    name_uz: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Fuel Types ----
class FuelTypeCreate(BaseModel):
    code: str
    name_uz: str
    unit: str = "litr"


class FuelTypeUpdate(BaseModel):
    code: Optional[str] = None
    name_uz: Optional[str] = None
    unit: Optional[str] = None


class FuelTypeResponse(BaseModel):
    id: str
    code: str
    name: str
    name_uz: str
    unit: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Vehicles ----
class VehicleCreate(BaseModel):
    code: str
    name_uz: str
    department_id: str
    fuel_type_id: str


class VehicleUpdate(BaseModel):
    code: Optional[str] = None
    name_uz: Optional[str] = None
    department_id: Optional[str] = None
    fuel_type_id: Optional[str] = None


class VehicleResponse(BaseModel):
    id: str
    code: str
    name: str
    name_uz: str
    department_id: str
    fuel_type_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Monthly Limits ----
class MonthlyLimitCreate(BaseModel):
    department_id: str
    section_id: Optional[str] = None
    fuel_type_id: str
    year: int
    month: int
    limit_value: Decimal = Decimal("0")


class MonthlyLimitUpdate(BaseModel):
    limit_value: Optional[Decimal] = None


class MonthlyLimitResponse(BaseModel):
    id: str
    department_id: str
    section_id: Optional[str]
    fuel_type_id: str
    year: int
    month: int
    limit_value: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---- Daily Entries ----
#
# Numeric fields are declared as ``float`` on purpose: FastAPI serializes
# pydantic ``Decimal`` fields as JSON *strings* ("250.00"), which the frontend
# type contract (``number``) and the table renderer cannot consume - every
# quantity was rendered as 0. Emitting real JSON numbers keeps the Decimal
# values in the database (Numeric(14, 2)) while giving the client the type it
# declares.
#
# Reference data (texnika / sex / bo'lim / yoqilg'i turi) is embedded as nested
# objects so the Kunlik kiritish table, the Excel export and the summary totals
# can render names and codes instead of showing "—" for every row.

class EntryVehicleRef(BaseModel):
    id: UUID4
    code: str
    name_uz: str

    class Config:
        from_attributes = True


class EntryCompanyRef(BaseModel):
    id: UUID4
    short_name: str

    class Config:
        from_attributes = True


class EntryDepartmentRef(BaseModel):
    id: UUID4
    code: str
    name_uz: str
    is_total: bool
    company: Optional[EntryCompanyRef] = None

    class Config:
        from_attributes = True


class EntrySectionRef(BaseModel):
    id: UUID4
    name: str
    name_uz: str

    class Config:
        from_attributes = True


class EntryFuelTypeRef(BaseModel):
    id: UUID4
    code: str
    name_uz: str
    unit: str

    class Config:
        from_attributes = True


class DailyEntryCreate(BaseModel):
    entry_date: date
    department_id: str
    section_id: Optional[str] = None
    vehicle_id: str
    fuel_type_id: str
    opening_balance: Decimal = Decimal("0")
    received_azs: Decimal = Decimal("0")
    transfer_in: Decimal = Decimal("0")
    transfer_out: Decimal = Decimal("0")
    consumption: Decimal = Decimal("0")
    closing_balance: Decimal = Decimal("0")

class DailyEntryUpdate(BaseModel):
    opening_balance: Optional[Decimal] = None
    received_azs: Optional[Decimal] = None
    transfer_in: Optional[Decimal] = None
    transfer_out: Optional[Decimal] = None
    consumption: Optional[Decimal] = None
    closing_balance: Optional[Decimal] = None


class DailyEntryResponse(BaseModel):
    id: UUID4
    entry_date: date
    department_id: UUID4
    section_id: Optional[UUID4] = None
    vehicle_id: UUID4
    fuel_type_id: UUID4
    opening_balance: float
    received_azs: float
    transfer_in: float
    transfer_out: float
    consumption: float
    closing_balance: float
    created_by: Optional[UUID4] = None
    created_at: datetime
    updated_at: datetime

    department: Optional[EntryDepartmentRef] = None
    section: Optional[EntrySectionRef] = None
    vehicle: Optional[EntryVehicleRef] = None
    fuel_type: Optional[EntryFuelTypeRef] = None

    class Config:
        from_attributes = True


# ---- Audit Log ----
class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str]
    action: str
    table_name: str
    row_id: Optional[str]
    details: Optional[dict]
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Role Permissions ----
class RolePermissionResponse(BaseModel):
    id: str
    role: str
    module: str
    permission: str
    allowed: bool

    class Config:
        from_attributes = True


class RolePermissionUpdate(BaseModel):
    allowed: bool
