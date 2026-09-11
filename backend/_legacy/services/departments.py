import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, status, Query

from app.dependencies.auth import get_current_active_user
from app.dependencies.db import get_async_db
from app.dependencies.permissions import RequirePermission
from app.schemas.common import PaginatedResponse, SuccessResponse
from app.schemas.department import DepartmentRead, DepartmentCreate, DepartmentUpdate
from app.services.department_service import DepartmentService

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post("/", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(RequirePermission("departments.create"))])
async def create_department(
    department_in: DepartmentCreate,
    service: Annotated[DepartmentService, Depends()],
):
    return await service.create(department_in)


@router.get("/", response_model=PaginatedResponse[DepartmentRead], dependencies=[Depends(RequirePermission("departments.read"))])
async def get_departments(
    service: Annotated[DepartmentService, Depends()],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
):
    items, total = await service.get_multi(page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order)
    return PaginatedResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/{item_id}", response_model=DepartmentRead, dependencies=[Depends(RequirePermission("departments.read"))])
async def get_department(
    item_id: uuid.UUID,
    service: Annotated[DepartmentService, Depends()],
):
    return await service.get(item_id)


@router.patch("/{item_id}", response_model=DepartmentRead, dependencies=[Depends(RequirePermission("departments.update"))])
async def update_department(
    item_id: uuid.UUID,
    department_in: DepartmentUpdate,
    service: Annotated[DepartmentService, Depends()],
):
    return await service.update(item_id, department_in)


@router.delete("/{item_id}", response_model=SuccessResponse, dependencies=[Depends(RequirePermission("departments.delete"))])
async def delete_department(
    item_id: uuid.UUID,
    service: Annotated[DepartmentService, Depends()],
):
    await service.soft_delete(item_id)
    return SuccessResponse(message="Department soft-deleted successfully.")


@router.post("/{item_id}/restore", response_model=DepartmentRead, dependencies=[Depends(RequirePermission("departments.delete"))])
async def restore_department(
    item_id: uuid.UUID,
    service: Annotated[DepartmentService, Depends()],
):
    return await service.restore(item_id)