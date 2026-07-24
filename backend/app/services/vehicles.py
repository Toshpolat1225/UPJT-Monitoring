import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, status, Query

from app.dependencies.permissions import RequirePermission
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.vehicle import VehicleRead, VehicleCreate, VehicleUpdate
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.post("/", response_model=VehicleRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(RequirePermission("vehicles.create"))])
async def create_vehicle(
    vehicle_in: VehicleCreate,
    service: Annotated[VehicleService, Depends()],
):
    return await service.create(vehicle_in)


@router.get("/", response_model=PaginatedResponse[VehicleRead], dependencies=[Depends(RequirePermission("vehicles.read"))])
async def get_vehicles(
    service: Annotated[VehicleService, Depends()],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    department_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None),
):
    filters = {}
    if department_id:
        filters["department_id"] = department_id
    if search:
        # This assumes search is on 'name_uz' or 'code'. BaseRepository needs to handle this.
        # For simplicity, let's assume search on name_uz
        filters["name_uz"] = search

    items, total = await service.get_multi(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order,
        load_relations=["department", "fuel_type"], **filters
    )
    return PaginatedResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/{item_id}", response_model=VehicleRead, dependencies=[Depends(RequirePermission("vehicles.read"))])
async def get_vehicle(
    item_id: uuid.UUID,
    service: Annotated[VehicleService, Depends()],
):
    return await service.get(item_id, load_relations=["department", "fuel_type"])


@router.patch("/{item_id}", response_model=VehicleRead, dependencies=[Depends(RequirePermission("vehicles.update"))])
async def update_vehicle(
    item_id: uuid.UUID,
    vehicle_in: VehicleUpdate,
    service: Annotated[VehicleService, Depends()],
):
    return await service.update(item_id, vehicle_in)


@router.delete("/{item_id}", response_model=SuccessResponse, dependencies=[Depends(RequirePermission("vehicles.delete"))])
async def delete_vehicle(
    item_id: uuid.UUID,
    service: Annotated[VehicleService, Depends()],
):
    await service.soft_delete(item_id)
    return SuccessResponse(message="Vehicle soft-deleted successfully.")