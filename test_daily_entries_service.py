import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.factories import VehicleFactory, FuelLimitFactory, DepartmentFactory, SectionFactory


@pytest.mark.asyncio
async def test_create_daily_entry_success(client: AsyncClient, db_session: AsyncSession, gsm_auth_headers):
    """Test successful creation of a daily fuel entry within the monthly limit."""
    dept = await DepartmentFactory.create(session=db_session)
    sec = await SectionFactory.create(session=db_session, department_id=dept.id)
    veh = await VehicleFactory.create(session=db_session, section_id=sec.id)
    await FuelLimitFactory.create(session=db_session, vehicle_id=veh.id, monthly_limit_liters=1000.0)

    payload = {
        "vehicle_id": veh.id,
        "liters_given": 120.0,
        "driver_name": "Eshmatov Toshmat",
        "entry_date": "2026-07-25"
    }

    response = await client.post("/api/v1/daily-entries", json=payload, headers=gsm_auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["liters_given"] == 120.0
    assert data["vehicle_id"] == veh.id


@pytest.mark.asyncio
async def test_create_daily_entry_exceeds_limit(client: AsyncClient, db_session: AsyncSession, gsm_auth_headers):
    """Test that the system returns a 400 Bad Request when a daily entry exceeds the monthly limit."""
    dept = await DepartmentFactory.create(session=db_session)
    sec = await SectionFactory.create(session=db_session, department_id=dept.id)
    veh = await VehicleFactory.create(session=db_session, section_id=sec.id)
    await FuelLimitFactory.create(session=db_session, vehicle_id=veh.id, monthly_limit_liters=100.0)

    payload = {
        "vehicle_id": veh.id,
        "liters_given": 150.0,  # 150 liters given, but limit is 100
        "driver_name": "Eshmatov Toshmat",
        "entry_date": "2026-07-25"
    }

    response = await client.post("/api/v1/daily-entries", json=payload, headers=gsm_auth_headers)
    assert response.status_code == 400
    assert "Monthly limit exceeded" in response.json()["detail"]