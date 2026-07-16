from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user, require_role, get_user_roles
from app.models.user import Profile, UserRole
from app.models.department import Department
from app.schemas.schemas import UserCreate, UserUpdate, ProfileResponse

router = APIRouter(prefix="/api/users", tags=["users"])

VALID_ROLES = ["admin", "gsm", "operator", "master", "management"]


@router.get("/me", response_model=ProfileResponse)
def get_me(current_user: Profile = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=List[ProfileResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    return db.query(Profile).order_by(Profile.created_at.desc()).all()


@router.put("/{user_id}/roles")
def update_user_roles(
    user_id: str,
    roles: List[str],
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    for r in roles:
        if r not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role: {r}")
    db.query(UserRole).filter(UserRole.user_id == user_id).delete()
    for r in roles:
        db.add(UserRole(user_id=user_id, role=r))
    db.commit()
    return {"detail": "Roles updated"}
