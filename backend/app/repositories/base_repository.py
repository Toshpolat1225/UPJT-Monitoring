import uuid
from typing import Any, Generic, Type, TypeVar
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType], db_session: AsyncSession):
        self.model = model
        self.db_session = db_session

    async def get(self, item_id: uuid.UUID, load_relations: list[str] | None = None) -> ModelType | None:
        query = select(self.model).where(self.model.id == item_id, self.model.deleted_at.is_(None))
        if load_relations:
            for relation in load_relations:
                query = query.options(joinedload(getattr(self.model, relation)))
        result = await self.db_session.execute(query)
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        *,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        load_relations: list[str] | None = None,
        **filters: Any,
    ) -> tuple[list[ModelType], int]:
        query = select(self.model).where(self.model.deleted_at.is_(None))
        count_query = select(func.count()).select_from(self.model).where(self.model.deleted_at.is_(None))

        # Apply filters
        for key, value in filters.items():
            if value is not None:
                if isinstance(value, str):
                    query = query.where(getattr(self.model, key).ilike(f"%{value}%"))
                    count_query = count_query.where(getattr(self.model, key).ilike(f"%{value}%"))
                else:
                    query = query.where(getattr(self.model, key) == value)
                    count_query = count_query.where(getattr(self.model, key) == value)

        # Get total count
        total = await self.db_session.scalar(count_query)

        # Apply sorting
        if hasattr(self.model, sort_by):
            order_column = getattr(self.model, sort_by)
            if sort_order.lower() == "desc":
                query = query.order_by(order_column.desc())
            else:
                query = query.order_by(order_column.asc())

        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)

        # Eager load relations
        if load_relations:
            for relation in load_relations:
                query = query.options(joinedload(getattr(self.model, relation)))

        result = await self.db_session.execute(query)
        return result.scalars().all(), total

    async def create(self, obj_in: CreateSchemaType) -> ModelType:
        obj_in_data = obj_in.model_dump()
        db_obj = self.model(**obj_in_data)
        self.db_session.add(db_obj)
        await self.db_session.flush()
        await self.db_session.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: ModelType, obj_in: UpdateSchemaType | dict[str, Any]) -> ModelType:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        self.db_session.add(db_obj)
        await self.db_session.flush()
        await self.db_session.refresh(db_obj)
        return db_obj

    async def soft_delete(self, item_id: uuid.UUID) -> ModelType | None:
        db_obj = await self.get(item_id)
        if db_obj:
            setattr(db_obj, 'deleted_at', func.now())
            self.db_session.add(db_obj)
            await self.db_session.flush()
            await self.db_session.refresh(db_obj)
        return db_obj

    async def restore(self, item_id: uuid.UUID) -> ModelType | None:
        query = select(self.model).where(self.model.id == item_id, self.model.deleted_at.is_not(None))
        result = await self.db_session.execute(query)
        db_obj = result.scalar_one_or_none()
        if db_obj:
            setattr(db_obj, 'deleted_at', None)
            self.db_session.add(db_obj)
            await self.db_session.flush()
            await self.db_session.refresh(db_obj)
        return db_obj

    async def get_by_attribute(self, attribute: str, value: Any) -> ModelType | None:
        query = select(self.model).where(
            getattr(self.model, attribute) == value,
            self.model.deleted_at.is_(None)
        )
        result = await self.db_session.execute(query)
        return result.scalar_one_or_none()