from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.routers import audit, auth, dashboard, entries, fuel_matrix, limits, master_data, permissions, users

app = FastAPI(
    title=settings.APP_NAME,
    description="Fuel & Transport Monitoring System API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(entries.router)
app.include_router(dashboard.router)
app.include_router(limits.router)
app.include_router(master_data.router)
app.include_router(fuel_matrix.router)
app.include_router(permissions.router)
app.include_router(audit.router)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Fuel Monitoring API"}
