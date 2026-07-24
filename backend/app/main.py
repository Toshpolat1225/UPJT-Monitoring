from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config.settings import get_settings
from app.api.v1.routers.auth import router as auth_router

settings = get_settings()

app = FastAPI(
    title=settings.app.APP_NAME,
    description="Fuel & Transport Monitoring System API",
    version=settings.app.APP_VERSION,
    debug=settings.app.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.app.CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.app.API_V1_PREFIX)
# Other routers will be included here


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Fuel Monitoring API"}
