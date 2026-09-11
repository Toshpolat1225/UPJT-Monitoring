import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from .base_service import BaseService
from app.models.vehicle import Vehicle
from app.repositories.vehicle_repository import VehicleRepository
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


class VehicleService(BaseService[Vehicle, VehicleRepository, VehicleCreate, VehicleUpdate]):
    def __init__(self, db_session: AsyncSession):
        super().__init__(VehicleRepository(db_session))

    async def _validate_fuel_matrix(self, department_id: uuid.UUID, fuel_type_id: uuid.UUID):
        is_allowed = await self.repo.is_fuel_type_allowed_for_department(department_id, fuel_type_id)
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This fuel type is not allowed for the selected department."
            )

    async def create(self, obj_in: VehicleCreate) -> Vehicle:
        async with self.repo.db_session.begin():
            await self._validate_fuel_matrix(obj_in.department_id, obj_in.fuel_type_id)
            return await self.repo.create(obj_in)

    async def update(self, item_id: uuid.UUID, obj_in: VehicleUpdate) -> Vehicle:
        async with self.repo.db_session.begin():
            db_obj = await self.get(item_id)
            department_id = obj_in.department_id or db_obj.department_id
            fuel_type_id = obj_in.fuel_type_id or db_obj.fuel_type_id
            await self._validate_fuel_matrix(department_id, fuel_type_id)
            return await self.repo.update(db_obj, obj_in)