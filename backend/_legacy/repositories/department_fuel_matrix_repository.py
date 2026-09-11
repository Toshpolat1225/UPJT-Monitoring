import uuid
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.department_fuel_matrix import DepartmentFuelMatrix
from app.models.fuel_type import FuelType
from app.repositories.base_repository import BaseRepository
from app.schemas.fuel_matrix import DepartmentFuelMatrixCreate, DepartmentFuelMatrixUpdate


class DepartmentFuelMatrixRepository(
    BaseRepository[DepartmentFuelMatrix, DepartmentFuelMatrixCreate, DepartmentFuelMatrixUpdate]
):
    def __init__(self, db_session: AsyncSession):
        super().__init__(DepartmentFuelMatrix, db_session)

    async def bulk_create_for_department(self, department_id: uuid.UUID):
        """
        Creates fuel matrix entries for a new department for all existing active fuel types
        using a single INSERT INTO ... SELECT statement for maximum performance.
        """
        # Barcha aktiv yoqilg'i turlari bo'yicha bitta SELECT so'rovi
        select_stmt = select(
            literal(department_id, UUID),
            FuelType.id
        ).where(FuelType.deleted_at.is_(None))

        # Bulk INSERT so'rovi
        stmt = insert(DepartmentFuelMatrix).from_select(
            ["department_id", "fuel_type_id"],
            select_stmt
        )
        await self.db_session.execute(stmt)