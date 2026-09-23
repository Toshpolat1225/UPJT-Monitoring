from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.company import Company
from app.models.department import Department
from app.models.fuel_type import FuelType
from app.models.section import Section
from app.models.user import Profile
from app.models.vehicle import Vehicle
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate
from app.schemas.department import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.schemas.fuel_type import FuelTypeCreate, FuelTypeRead, FuelTypeUpdate
from app.schemas.section import SectionCreate, SectionRead, SectionUpdate
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate

router = APIRouter(prefix="/api/master-data", tags=["master-data"])


@router.get("/departments", response_model=List[DepartmentRead])
def list_departments(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    return db.query(Department).order_by(Department.created_at.desc()).all()


@router.post("/departments", response_model=DepartmentRead)
def create_department(
    department: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    new_department = Department(
        code=department.code,
        name_uz=department.name_uz,
        is_total=department.is_total,
        company_id=department.company_id,
    )
    db.add(new_department)
    db.commit()
    db.refresh(new_department)
    return new_department


@router.put("/departments/{department_id}", response_model=DepartmentRead)
def update_department(
    department_id: str,
    updates: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(department, field, value)

    db.commit()
    db.refresh(department)
    return department


@router.delete("/departments/{department_id}")
def delete_department(
    department_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    db.delete(department)
    db.commit()
    return {"detail": "Department deleted"}


@router.get("/sections", response_model=List[SectionRead])
def list_sections(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    return db.query(Section).order_by(Section.created_at.desc()).all()


@router.post("/sections", response_model=SectionRead)
def create_section(
    section: SectionCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    new_section = Section(
        department_id=section.department_id,
        name=section.name,
        name_uz=section.name_uz,
    )
    db.add(new_section)
    db.commit()
    db.refresh(new_section)
    return new_section


@router.put("/sections/{section_id}", response_model=SectionRead)
def update_section(
    section_id: str,
    updates: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(section, field, value)

    db.commit()
    db.refresh(section)
    return section


@router.delete("/sections/{section_id}")
def delete_section(
    section_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    section = db.query(Section).filter(Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    db.delete(section)
    db.commit()
    return {"detail": "Section deleted"}


@router.get("/vehicles", response_model=List[VehicleRead])
def list_vehicles(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    return db.query(Vehicle).order_by(Vehicle.created_at.desc()).all()


@router.post("/vehicles", response_model=VehicleRead)
def create_vehicle(
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    new_vehicle = Vehicle(
        code=vehicle.code,
        name_uz=vehicle.name_uz,
        department_id=vehicle.department_id,
        fuel_type_id=vehicle.fuel_type_id,
    )
    allowed_ids = vehicle.allowed_fuel_type_ids or [vehicle.fuel_type_id]
    new_vehicle.allowed_fuel_types = db.query(FuelType).filter(FuelType.id.in_(allowed_ids)).all()
    if len(new_vehicle.allowed_fuel_types) != len(set(allowed_ids)):
        raise HTTPException(status_code=422, detail="Unknown fuel type in vehicle permissions")
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    return new_vehicle


@router.put("/vehicles/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(
    vehicle_id: str,
    updates: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        if field == "allowed_fuel_type_ids":
            continue
        setattr(vehicle, field, value)

    if updates.allowed_fuel_type_ids is not None:
        allowed_ids = updates.allowed_fuel_type_ids or [vehicle.fuel_type_id]
        vehicle.allowed_fuel_types = db.query(FuelType).filter(FuelType.id.in_(allowed_ids)).all()
        if len(vehicle.allowed_fuel_types) != len(set(allowed_ids)):
            raise HTTPException(status_code=422, detail="Unknown fuel type in vehicle permissions")

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}")
def delete_vehicle(
    vehicle_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    db.delete(vehicle)
    db.commit()
    return {"detail": "Vehicle deleted"}


@router.get("/fuel-types", response_model=List[FuelTypeRead])
def list_fuel_types(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    return db.query(FuelType).order_by(FuelType.created_at.desc()).all()


@router.post("/fuel-types", response_model=FuelTypeRead)
def create_fuel_type(
    fuel_type: FuelTypeCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    new_fuel_type = FuelType(
        code=fuel_type.code,
        name_uz=fuel_type.name_uz,
        unit=fuel_type.unit,
    )
    db.add(new_fuel_type)
    db.commit()
    db.refresh(new_fuel_type)
    return new_fuel_type


@router.put("/fuel-types/{fuel_type_id}", response_model=FuelTypeRead)
def update_fuel_type(
    fuel_type_id: str,
    updates: FuelTypeUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    fuel_type = db.query(FuelType).filter(FuelType.id == fuel_type_id).first()
    if not fuel_type:
        raise HTTPException(status_code=404, detail="FuelType not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(fuel_type, field, value)

    db.commit()
    db.refresh(fuel_type)
    return fuel_type


@router.delete("/fuel-types/{fuel_type_id}")
def delete_fuel_type(
    fuel_type_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    fuel_type = db.query(FuelType).filter(FuelType.id == fuel_type_id).first()
    if not fuel_type:
        raise HTTPException(status_code=404, detail="FuelType not found")

    db.delete(fuel_type)
    db.commit()
    return {"detail": "FuelType deleted"}


@router.get("/companies", response_model=List[CompanyRead])
def list_companies(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    return db.query(Company).order_by(Company.created_at.desc()).all()


@router.post("/companies", response_model=CompanyRead)
def create_company(
    company: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    new_company = Company(
        short_name=company.short_name,
        full_name=company.full_name,
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return new_company


@router.put("/companies/{company_id}", response_model=CompanyRead)
def update_company(
    company_id: str,
    updates: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "operator")),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(company, field, value)

    db.commit()
    db.refresh(company)
    return company


@router.delete("/companies/{company_id}")
def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    db.delete(company)
    db.commit()
    return {"detail": "Company deleted"}
