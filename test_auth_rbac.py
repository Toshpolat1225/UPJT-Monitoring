import pytest
from httpx import AsyncClient
from app.core.security import create_access_token, decode_access_token


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Test API readiness."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "UPJT Monitoring API"}


@pytest.mark.asyncio
async def test_jwt_token_encode_decode():
    """Test that a JWT token can be correctly encoded and decoded."""
    payload = {"sub": "test@upjt.uz", "role": "ADMIN", "user_id": 99}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    
    assert decoded["sub"] == payload["sub"]
    assert decoded["role"] == payload["role"]
    assert decoded["user_id"] == payload["user_id"]


@pytest.mark.asyncio
async def test_rbac_admin_endpoint_access(client: AsyncClient, admin_auth_headers, master_auth_headers):
    """Test that an ADMIN endpoint is accessible to ADMINs but not to MASTERs."""
    # ADMIN should have access
    response_admin = await client.get("/api/v1/admin/users", headers=admin_auth_headers)
    assert response_admin.status_code == 200

    # MASTER should be forbidden
    response_master = await client.get("/api/v1/admin/users", headers=master_auth_headers)
    assert response_master.status_code == 403
    assert response_master.json()["detail"] == "Permission denied: Requires ADMIN role"


@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    """Test that a request without auth headers receives a 401 Unauthorized."""
    response = await client.get("/api/v1/admin/users")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"