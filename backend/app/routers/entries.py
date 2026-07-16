from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import and_
from typing import List, Optional
from datetime import date
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.daily_entry import DailyEntry
from app.models.vehicle import Vehicle
from app.models.department import Department
from app.models.section import Section
from app.models.fuel_type import FuelType
from app.schemas.schemas import DailyEntryCreate, DailyEntryUpdate, DailyEntryResponse

router = APIRouter(prefix="/api/entries", tags=["entries"])


@router.get("/", response_model=List[DailyEntryResponse])
def list_entries(
    entry_date: Optional[date] = Query(None),
    department_id: Optional[str] = Query(None),
    vehicle_id: Optional[str] = Query(None),
    fuel_type_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: DailyEntry = Depends(get_current_user),
):
    query = db.query(DailyEntry)
    if entry_date:
        query = query.filter(DailyEntry.entry_date == entry_date)
    if department_id:
        query = query.filter(DailyEntry.department_id == department_id)
    if vehicle_id:
        query = query.filter(DailyEntry.vehicle_id == vehicle_id)
    if fuel_type_id:
        query = query.filter(DailyEntry.fuel_type_id == fuel_type_id)
    if date_from:
        query = query.filter(DailyEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(DailyEntry.entry_date <= date_to)
    return query.order_by(DailyEntry.entry_date.desc()).all()


@router.post("/", response_model=DailyEntryResponse, status_code=201)
def create_entry(
    entry: DailyEntryCreate,
    db: Session = Depends(get_db),
    current_user: Profile := Depends(require_role("admin", "gsm", "operator", "master")),
):
    existing = db.query(DailyEntry).filter(
        DailyEntry.entry_date == entry.entry_date,
        DailyEntry.vehicle_id == entry.vehicle_id,
        DailyEntry.fuel_type_id == entry.fuel_type_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Entry already exists for this date/vehicle/fuel")

    new_entry = DailyEntry(
        entry_date=entry.entry_date,
        department_id=entry.department_id,
        section_id=entry.section_id,
        vehicle_id=entry.vehicle_id,
        fuel_type_id=entry.fuel_type_id,
        opening_balance=entry.opening_balance,
        received_azs=entry.received_azs,
        transfer_in=entry.transfer_in,
        transfer_out=entry.transfer_out,
        consumption=entry.consumption,
        closing_balance=entry.closing_balance,
        created_by=str(current_user.id),
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry


@router.put("/{entry_id}", response_model=DailyEntryResponse)
def update_entry(
    entry_id: str,
    updates: DailyEntryUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "operator", "master")),
):
    entry = db.query(DailyEntry).filter(DailyEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    entry = db.query(DailyEntry).filter(DailyEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"detail": "Entry deleted"}
