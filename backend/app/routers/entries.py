from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from datetime import date
from decimal import Decimal
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.daily_entry import DailyEntry
from app.models.user import Profile
from app.models.vehicle import Vehicle
from app.models.department import Department
from app.models.section import Section
from app.models.fuel_type import FuelType
from app.schemas.schemas import DailyEntryCreate, DailyEntryUpdate, DailyEntryResponse
from app.services.aggregation import compute_closing_balance
from app.services.entry_service import lock_chain, lock_chains, recalculate_following_balances, resolve_opening_balance

router = APIRouter(prefix="/api/entries", tags=["entries"])


def _with_entry_references(query):
    """Load table/export reference values as part of the response contract."""
    return query.options(
        selectinload(DailyEntry.vehicle),
        selectinload(DailyEntry.department).selectinload(Department.company),
        selectinload(DailyEntry.section),
        selectinload(DailyEntry.fuel_type),
    )


def _validate_balance(opening_balance, received_azs, transfer_in, transfer_out, consumption, closing_balance):
    values = [opening_balance, received_azs, transfer_in, transfer_out, consumption, closing_balance]
    if any(Decimal(str(value)) < 0 for value in values):
        raise HTTPException(status_code=422, detail="Fuel balances and quantities cannot be negative")
    calculated = Decimal(str(opening_balance)) + Decimal(str(received_azs)) + Decimal(str(transfer_in)) - Decimal(str(transfer_out)) - Decimal(str(consumption))
    if calculated < 0 or Decimal(str(closing_balance)) < 0:
        raise HTTPException(status_code=422, detail="Operation would create a negative balance")


def _validate_vehicle_fuel(db: Session, vehicle_id: str, fuel_type_id: str) -> Vehicle:
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=422, detail="Vehicle not found")
    allowed_ids = {str(fuel.id) for fuel in (vehicle.allowed_fuel_types or [])}
    if not allowed_ids:
        allowed_ids = {str(vehicle.fuel_type_id)}
    if str(fuel_type_id) not in allowed_ids:
        raise HTTPException(status_code=422, detail="Fuel type is not allowed for this vehicle")
    return vehicle


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
    query = _with_entry_references(db.query(DailyEntry))
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
    return query.order_by(DailyEntry.entry_date.desc(), DailyEntry.created_at.desc()).all()


@router.get("/opening-balance")
def get_opening_balance(
    vehicle_id: str,
    fuel_type_id: str,
    entry_date: date,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Derived, non-editable opening balance for the selected transport."""
    opening = resolve_opening_balance(db, vehicle_id, fuel_type_id, entry_date, 0)
    return {"opening_balance": float(opening)}


@router.post("/", response_model=DailyEntryResponse, status_code=201)
def create_entry(
    entry: DailyEntryCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "operator", "master")),
):
    _validate_vehicle_fuel(db, entry.vehicle_id, entry.fuel_type_id)
    lock_chain(db, entry.vehicle_id, entry.fuel_type_id)

    opening = resolve_opening_balance(
        db, entry.vehicle_id, entry.fuel_type_id, entry.entry_date, entry.opening_balance
    )
    closing = compute_closing_balance(
        opening, entry.received_azs, entry.transfer_in, entry.transfer_out, entry.consumption
    )
    _validate_balance(opening, entry.received_azs, entry.transfer_in,
                      entry.transfer_out, entry.consumption, closing)

    new_entry = DailyEntry(
        entry_date=entry.entry_date,
        department_id=entry.department_id,
        section_id=entry.section_id,
        vehicle_id=entry.vehicle_id,
        fuel_type_id=entry.fuel_type_id,
        opening_balance=opening,
        received_azs=entry.received_azs,
        transfer_in=entry.transfer_in,
        transfer_out=entry.transfer_out,
        consumption=entry.consumption,
        closing_balance=closing,
        created_by=str(current_user.id),
    )
    db.add(new_entry)
    db.flush()
    try:
        recalculate_following_balances(db, entry.vehicle_id, entry.fuel_type_id, entry.entry_date)
        db.commit()
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error
    return _with_entry_references(db.query(DailyEntry)).filter(DailyEntry.id == new_entry.id).first()


@router.put("/{entry_id}", response_model=DailyEntryResponse)
def update_entry(
    entry_id: str,
    updates: DailyEntryUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "operator", "master")),
):
    entry = _with_entry_references(db.query(DailyEntry)).filter(DailyEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    old_chain = (entry.vehicle_id, entry.fuel_type_id)
    old_entry_date = entry.entry_date
    new_vehicle_id = updates.vehicle_id or entry.vehicle_id
    new_fuel_type_id = updates.fuel_type_id or entry.fuel_type_id
    lock_chains(db, [old_chain, (new_vehicle_id, new_fuel_type_id)])
    entry = db.query(DailyEntry).filter(DailyEntry.id == entry_id).with_for_update().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    old_chain = (entry.vehicle_id, entry.fuel_type_id)
    new_vehicle_id = updates.vehicle_id or entry.vehicle_id
    new_fuel_type_id = updates.fuel_type_id or entry.fuel_type_id
    new_entry_date = updates.entry_date or entry.entry_date
    _validate_vehicle_fuel(db, str(new_vehicle_id), str(new_fuel_type_id))
    values = {
        "received_azs": entry.received_azs,
        "transfer_in": entry.transfer_in,
        "transfer_out": entry.transfer_out,
        "consumption": entry.consumption,
    }
    values.update(updates.model_dump(exclude_unset=True, exclude={"opening_balance", "closing_balance"}))
    values.pop("entry_date", None)
    values.pop("department_id", None)
    values.pop("section_id", None)
    values.pop("vehicle_id", None)
    values.pop("fuel_type_id", None)
    for field, value in values.items():
        setattr(entry, field, value)
    entry.entry_date = new_entry_date
    entry.department_id = updates.department_id or entry.department_id
    entry.section_id = updates.section_id if "section_id" in updates.model_fields_set else entry.section_id
    entry.vehicle_id = new_vehicle_id
    entry.fuel_type_id = new_fuel_type_id
    entry.updated_at = func.now()
    db.flush()
    try:
        if old_chain == (entry.vehicle_id, entry.fuel_type_id):
            from_date = min(old_entry_date, entry.entry_date)
            recalculate_following_balances(db, entry.vehicle_id, entry.fuel_type_id, from_date)
        else:
            recalculate_following_balances(db, old_chain[0], old_chain[1], old_entry_date)
            recalculate_following_balances(db, entry.vehicle_id, entry.fuel_type_id, entry.entry_date)
        db.commit()
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error
    return _with_entry_references(db.query(DailyEntry)).filter(DailyEntry.id == entry.id).first()


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    entry = db.query(DailyEntry).filter(DailyEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    vehicle_id, fuel_type_id, entry_date = entry.vehicle_id, entry.fuel_type_id, entry.entry_date
    lock_chain(db, vehicle_id, fuel_type_id)
    entry = db.query(DailyEntry).filter(DailyEntry.id == entry_id).with_for_update().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    vehicle_id, fuel_type_id, entry_date = entry.vehicle_id, entry.fuel_type_id, entry.entry_date
    db.delete(entry)
    db.flush()
    try:
        recalculate_following_balances(db, vehicle_id, fuel_type_id, entry_date)
        db.commit()
    except ValueError as error:
        db.rollback()
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {"detail": "Entry deleted"}
