from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.models.enums import AppRole
from app.models.user import Role
from app.routers import audit, auth, dashboard, entries, fuel_matrix, limits, master_data, permissions, users


def ensure_default_roles() -> None:
    required_roles = [role.value for role in AppRole]
    with SessionLocal() as db:
        existing = {row.name for row in db.query(Role).filter(Role.name.in_(required_roles)).all()}
        for role_name in required_roles:
            if role_name in existing:
                continue
            db.add(Role(name=role_name, description=f"Built-in {role_name} role"))
        db.commit()


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


@app.on_event("startup")
def startup_event() -> None:
    ensure_default_roles()


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Fuel Monitoring API"}
