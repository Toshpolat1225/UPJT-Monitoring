from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.department_fuel_matrix import DepartmentFuelMatrix
from app.models.user import Profile
from app.schemas.department_fuel_matrix import DepartmentFuelMatrixCreate, DepartmentFuelMatrixRead

router = APIRouter(prefix="/api/fuel-matrix", tags=["fuel-matrix"])


@router.get("", response_model=List[DepartmentFuelMatrixRead])
def list_fuel_matrix(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "operator", "management")),
):
    return db.query(DepartmentFuelMatrix).order_by(DepartmentFuelMatrix.created_at.desc()).all()


@router.post("", response_model=DepartmentFuelMatrixRead)
def upsert_fuel_matrix(
    item: DepartmentFuelMatrixCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "operator", "management")),
):
    existing = (
        db.query(DepartmentFuelMatrix)
        .filter(
            DepartmentFuelMatrix.department_id == item.department_id,
            DepartmentFuelMatrix.fuel_type_id == item.fuel_type_id,
        )
        .first()
    )

    if existing:
        existing.is_active = item.is_active
        existing.updated_at = existing.updated_at
        db.commit()
        db.refresh(existing)
        return existing

    new_item = DepartmentFuelMatrix(
        department_id=item.department_id,
        fuel_type_id=item.fuel_type_id,
        is_active=item.is_active,
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item


@router.delete("/{matrix_id}")
def delete_fuel_matrix(
    matrix_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    item = db.query(DepartmentFuelMatrix).filter(DepartmentFuelMatrix.id == matrix_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Department fuel matrix not found")

    db.delete(item)
    db.commit()
    return {"detail": "Department fuel matrix deleted"}
