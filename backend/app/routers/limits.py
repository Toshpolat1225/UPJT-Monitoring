from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.monthly_limit import MonthlyLimit
from app.models.user import Profile
from app.schemas.monthly_limit import MonthlyLimitCreate, MonthlyLimitRead, MonthlyLimitUpdate

router = APIRouter(prefix="/api/limits", tags=["limits"])


@router.get("", response_model=List[MonthlyLimitRead])
def list_limits(
    department_id: Optional[str] = Query(None),
    fuel_type_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "management", "operator", "master")),
):
    query = db.query(MonthlyLimit)

    if department_id:
        query = query.filter(MonthlyLimit.department_id == department_id)
    if fuel_type_id:
        query = query.filter(MonthlyLimit.fuel_type_id == fuel_type_id)
    if year is not None:
        query = query.filter(MonthlyLimit.year == year)
    if month is not None:
        query = query.filter(MonthlyLimit.month == month)

    return query.order_by(MonthlyLimit.created_at.desc()).all()


@router.post("", response_model=MonthlyLimitRead)
def create_limit(
    limit: MonthlyLimitCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "management")),
):
    existing = db.query(MonthlyLimit).filter(
        MonthlyLimit.department_id == limit.department_id,
        MonthlyLimit.section_id == limit.section_id,
        MonthlyLimit.fuel_type_id == limit.fuel_type_id,
        MonthlyLimit.year == limit.year,
        MonthlyLimit.month == limit.month,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Monthly limit already exists for this department/section/fuel/month")
    new_limit = MonthlyLimit(
        department_id=limit.department_id,
        section_id=limit.section_id,
        fuel_type_id=limit.fuel_type_id,
        year=limit.year,
        month=limit.month,
        limit_value=limit.limit_value,
    )
    db.add(new_limit)
    db.commit()
    db.refresh(new_limit)
    return new_limit


@router.put("/{limit_id}", response_model=MonthlyLimitRead)
def update_limit(
    limit_id: str,
    updates: MonthlyLimitUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "management")),
):
    limit = db.query(MonthlyLimit).filter(MonthlyLimit.id == limit_id).first()
    if not limit:
        raise HTTPException(status_code=404, detail="Monthly limit not found")

    values = updates.model_dump(exclude_unset=True)
    if values.get("limit_value") is not None and values["limit_value"] < 0:
        raise HTTPException(status_code=422, detail="Limit value cannot be negative")
    for field, value in values.items():
        setattr(limit, field, value)

    db.commit()
    db.refresh(limit)
    return limit


@router.delete("/{limit_id}")
def delete_limit(
    limit_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    limit = db.query(MonthlyLimit).filter(MonthlyLimit.id == limit_id).first()
    if not limit:
        raise HTTPException(status_code=404, detail="Monthly limit not found")

    db.delete(limit)
    db.commit()
    return {"detail": "Monthly limit deleted"}
