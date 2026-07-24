import factory
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User, UserRole
from app.models.master_data import Department, Section, Vehicle
from app.models.fuel import FuelLimit, DailyEntry


class BaseAsyncFactory(factory.alchemy.SQLAlchemyModelFactory):
    """Base factory to support async SQLAlchemy sessions."""
    class Meta:
        abstract = True
        sqlalchemy_session_persistence = "commit"

    @classmethod
    async def _create(cls, model_class, *args, **kwargs):
        session: AsyncSession = kwargs.pop("session", None)
        obj = model_class(*args, **kwargs)
        if session:
            session.add(obj)
            await session.flush()
            await session.refresh(obj)
        return obj


class UserFactory(BaseAsyncFactory):
    class Meta:
        model = User

    id = factory.Sequence(lambda n: n + 10)
    email = factory.Sequence(lambda n: f"user_{n}@upjt.uz")
    full_name = factory.Faker("name")
    hashed_password = "scrypt:32768:8:1$hashed_dummy_password"
    role = UserRole.MASTER
    is_active = True


class DepartmentFactory(BaseAsyncFactory):
    class Meta:
        model = Department

    id = factory.Sequence(lambda n: n + 1)
    name = factory.Sequence(lambda n: f"Boshqarma #{n}")
    code = factory.Sequence(lambda n: f"DEP-{n:03d}")


class SectionFactory(BaseAsyncFactory):
    class Meta:
        model = Section

    id = factory.Sequence(lambda n: n + 1)
    name = factory.Sequence(lambda n: f"Bo'lim #{n}")
    department_id = factory.LazyAttribute(lambda o: o.department.id if hasattr(o, 'department') else 1)


class VehicleFactory(BaseAsyncFactory):
    class Meta:
        model = Vehicle

    id = factory.Sequence(lambda n: n + 1)
    plate_number = factory.Sequence(lambda n: f"01{n:03d}AAA")
    model = "MAN TGS 33.400"
    fuel_type = "DIESEL"
    section_id = 1


class FuelLimitFactory(BaseAsyncFactory):
    class Meta:
        model = FuelLimit

    id = factory.Sequence(lambda n: n + 1)
    vehicle_id = 1
    monthly_limit_liters = 1500.0
    year = 2026
    month = 7


class DailyEntryFactory(BaseAsyncFactory):
    class Meta:
        model = DailyEntry

    id = factory.Sequence(lambda n: n + 1)
    vehicle_id = 1
    liters_given = 50.0
    driver_name = "Alijon Valiyev"
    entry_date = "2026-07-25"