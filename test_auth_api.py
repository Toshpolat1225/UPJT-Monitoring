import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient) -> None:
    """
    Tests the basic health check endpoint to ensure the API is responsive.
    """
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "UPJT Monitoring API"}

# More tests for login, token refresh, and RBAC would be added here.