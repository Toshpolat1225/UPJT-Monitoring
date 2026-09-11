from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.department_fuel_matrix import DepartmentFuelMatrix
from .base_repository import BaseRepository
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


class VehicleRepository(BaseRepository[Vehicle, VehicleCreate, VehicleUpdate]):
    def __init__(self, db_session: AsyncSession):
        super().__init__(Vehicle, db_session)

    async def is_fuel_type_allowed_for_department(self, department_id: str, fuel_type_id: str) -> bool:
        query = select(DepartmentFuelMatrix).where(
            DepartmentFuelMatrix.department_id == department_id,
            DepartmentFuelMatrix.fuel_type_id == fuel_type_id,
            DepartmentFuelMatrix.is_active == True
        )
        result = await self.db_session.execute(query)
        return result.scalar_one_or_none() is not None