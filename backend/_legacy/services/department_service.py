import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from .base_service import BaseService
from app.models.department import Department
from app.repositories.department_repository import DepartmentRepository
from app.repositories.department_fuel_matrix_repository import DepartmentFuelMatrixRepository
from app.schemas.department import DepartmentCreate, DepartmentUpdate


class DepartmentService(BaseService[Department, DepartmentRepository, DepartmentCreate, DepartmentUpdate]):
    def __init__(self, db_session: AsyncSession):
        super().__init__(DepartmentRepository(db_session))
        self.fuel_matrix_repo = DepartmentFuelMatrixRepository(db_session)

    async def create(self, obj_in: DepartmentCreate) -> Department:
        async with self.repo.db_session.begin():
            # Check for duplicate code
            existing = await self.repo.get_by_attribute("code", obj_in.code)
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department with this code already exists.")

            # Create the department
            new_department = await self.repo.create(obj_in)

            # Efficiently create fuel matrix entries for the new department
            await self.fuel_matrix_repo.bulk_create_for_department(new_department.id)

        return new_department