import time
import logging
from typing import Callable
from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from redis.asyncio import Redis

from app.core.redis_client import get_redis_client

logger = logging.getLogger("upjt.ratelimit")


class RedisRateLimiterMiddleware(BaseHTTPMiddleware):
    """
    A robust rate limiter using Redis for shared state across multiple workers/instances.
    """

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        redis: Redis = await get_redis_client()
        client_ip = request.client.host if request.client else "127.0.0.1"
        key = f"rate_limit:{client_ip}"

        # Use a pipeline for atomic operations
        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, time.time() - 60)
        pipe.zcard(key)
        pipe.zadd(key, {str(time.time()): time.time()})
        pipe.expire(key, 60)
        results = await pipe.execute()

        request_count = results[1]
        if request_count > self.requests_per_minute:
            logger.warning(f"[RATE_LIMIT] IP {client_ip} exceeded request limit.")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please try again in a minute."}
            )

        return await call_next(request)