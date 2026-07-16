from pydantic import BaseModel, EmailStr
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal


# ---- Auth ----
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""
    department_id: Optional[str] = None
    roles: List[str] = []


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    department_id: Optional[str] = None
    roles: Optional[List[str]] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ProfileResponse(BaseModel):
    id: str
    full_name: Optional[str]
    email: Optional[str]
    department_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: ProfileResponse


# ---- Departments ----
class DepartmentCreate(BaseModel):
    code: str
    name_uz: str
    name_ru: str
    is_total: bool = False


class DepartmentUpdate(BaseModel):
    code: Optional[str] = None
    name_uz: Optional[str] = None
    name_ru: Optional[str] = None
    is_total: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: str
    code: str
    name: str
    name_uz: str
    name_ru: str
    is_total: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Sections ----
class SectionCreate(BaseModel):
    department_id: str
    name_uz: str
    name_ru: str


class SectionUpdate(BaseModel):
    department_id: Optional[str] = None
    name_uz: Optional[str] = None
    name_ru: Optional[str] = None


class SectionResponse(BaseModel):
    id: str
    department_id: str
    name: str
    name_uz: str
    name_ru: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Fuel Types ----
class FuelTypeCreate(BaseModel):
    code: str
    name_uz: str
    name_ru: str
    unit: str = "litr"


class FuelTypeUpdate(BaseModel):
    code: Optional[str] = None
    name_uz: Optional[str] = None
    name_ru: Optional[str] = None
    unit: Optional[str] = None


class FuelTypeResponse(BaseModel):
    id: str
    code: str
    name: str
    name_uz: str
    name_ru: str
    unit: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Vehicles ----
class VehicleCreate(BaseModel):
    code: str
    name_uz: str
    name_ru: str
    department_id: str
    fuel_type_id: str


class VehicleUpdate(BaseModel):
    code: Optional[str] = None
    name_uz: Optional[str] = None
    name_ru: Optional[str] = None
    department_id: Optional[str] = None
    fuel_type_id: Optional[str] = None


class VehicleResponse(BaseModel):
    id: str
    code: str
    name: str
    name_uz: str
    name_ru: str
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
    id: str
    entry_date: date
    department_id: str
    section_id: Optional[str]
    vehicle_id: str
    fuel_type_id: str
    opening_balance: Decimal
    received_azs: Decimal
    transfer_in: Decimal
    transfer_out: Decimal
    consumption: Decimal
    closing_balance: Decimal
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

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
