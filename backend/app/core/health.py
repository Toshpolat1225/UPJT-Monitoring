import psutil
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis
from sqlalchemy import text

from app.db.session import get_db
from app.core.redis_client import get_redis_client
from app.core.config import Settings

router = APIRouter()

@router.get("/health", summary="Basic health check")
async def health_check():
    return {"status": "healthy", "service": "UPJT Monitoring API"}

@router.get("/health/database", summary="Database connectivity check")
async def health_check_db(db: AsyncSession = Depends(get_db)):
    try:
        # Use text() for raw SQL execution in SQLAlchemy 2.0
        await db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection failed: {e}"
        )

@router.get("/health/cache", summary="Cache (Redis) connectivity check")
async def health_check_cache(redis: Redis = Depends(get_redis_client)):
    try:
        await redis.ping()
        return {"status": "healthy", "cache": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cache (Redis) connection failed: {e}"
        )

@router.get("/health/system", summary="System resource check (CPU, Memory, Disk)")
async def health_check_system():
    cpu_percent = psutil.cpu_percent(interval=1)
    memory_info = psutil.virtual_memory()
    disk_usage = psutil.disk_usage('/')

    if cpu_percent > 90:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"High CPU usage: {cpu_percent}%"
        )
    if memory_info.percent > 90:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"High Memory usage: {memory_info.percent}%"
        )
    if disk_usage.percent > 90:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"High Disk usage: {disk_usage.percent}%"
        )

    return {
        "status": "healthy",
        "cpu_usage_percent": cpu_percent,
        "memory_usage_percent": memory_info.percent,
        "disk_usage_percent": disk_usage.percent,
    }