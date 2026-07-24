import logging

from fastapi import FastAPI, Request, status, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import generate_latest
from starlette_prometheus import PrometheusMiddleware
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError

from app.core.config import Settings
from app.core.logging import setup_logging
from app.core.middlewares import RequestIDMiddleware, LoggingMiddleware
from app.core.exceptions import CustomException, integrity_error_handler, validation_error_handler
from app.core import health as health_router
from app.api.v1.routers.auth import router as auth_router

settings = Settings()
setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.APP_NAME,
    description="Fuel & Transport Monitoring System API",
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(PrometheusMiddleware, app_name=settings.APP_NAME)

app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(ValidationError, validation_error_handler)
app.add_exception_handler(CustomException, custom_exception_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "N/A")
    logger.exception(f"Unhandled exception for request_id: {request_id}", extra={"request_id": request_id})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An unexpected error occurred.",
            "error_code": "UNEXPECTED_ERROR",
            "request_id": request_id,
            "details": {"error_type": type(exc).__name__},
        },
    )

app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(health_router.router, prefix=settings.API_V1_PREFIX)


@app.get("/metrics", include_in_schema=False, summary="Prometheus Metrics")
async def get_prometheus_metrics():
    return Response(content=generate_latest(), media_type="text/plain; version=0.0.4")
