from typing import List
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, get_user_roles, hash_password, require_role
from app.models.user import Profile, Role, User, UserRole
from app.models.audit_log import AuditLog
from app.schemas.schemas import ProfileResponse, UserCreate, UserUpdate, UserPasswordReset, UserStatusUpdate

router = APIRouter(prefix="/api/users", tags=["users"])
VALID_ROLES = {"admin", "gsm", "operator", "master", "management"}


def _profile_response(db: Session, user: User) -> ProfileResponse:
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    return ProfileResponse(
        id=str(user.id),
        full_name=profile.full_name if profile else None,
        email=user.email,
        department_id=str(profile.department_id) if profile and profile.department_id else None,
        company_id=str(profile.company_id) if profile and profile.company_id else None,
        roles=get_user_roles(db, str(user.id)),
        is_active=user.is_active,
        created_at=user.created_at,
    )


def _audit(db: Session, actor: User, action: str, target: User, details: dict | None = None) -> None:
    """Log user-management metadata only; never passwords or hashes."""
    db.add(AuditLog(user_id=actor.id, action=action, table_name="users", row_id=target.id, details=details))


def _is_admin(db: Session, user: User) -> bool:
    return "admin" in get_user_roles(db, str(user.id))


def _admin_count(db: Session) -> int:
    return db.query(User).join(UserRole).join(Role).filter(Role.name == "admin", User.is_active.is_(True)).count()


def _ensure_admin_survives(db: Session, target: User, *, will_be_active: bool, will_be_admin: bool, actor: User) -> None:
    removing_active_admin = _is_admin(db, target) and (not will_be_active or not will_be_admin)
    if not removing_active_admin:
        return
    if target.id == actor.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate yourself or remove your own admin role")
    if _admin_count(db) <= 1:
        raise HTTPException(status_code=400, detail="At least one active admin must remain")


@router.post("", response_model=ProfileResponse, status_code=201)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    invalid_roles = set(payload.roles) - VALID_ROLES
    if invalid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {sorted(invalid_roles)[0]}")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        id=uuid4(),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_superuser="admin" in payload.roles,
    )
    db.add(user)
    db.flush()
    db.add(Profile(id=uuid4(), user_id=user.id, full_name=payload.full_name or None,
                   department_id=payload.department_id, company_id=payload.company_id))
    role_rows = {role.name: role for role in db.query(Role).filter(Role.name.in_(payload.roles)).all()}
    for role_name in payload.roles:
        role = role_rows.get(role_name)
        if role is None:
            raise HTTPException(status_code=400, detail=f"Role is not configured: {role_name}")
        db.add(UserRole(user_id=user.id, role_id=role.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="User could not be created")
    _audit(db, current_user, "user_created", user, {"roles": payload.roles})
    db.commit()
    db.refresh(user)
    return _profile_response(db, user)


@router.get("/me", response_model=ProfileResponse)
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _profile_response(db, current_user)


@router.put("/{user_id}", response_model=ProfileResponse)
def update_profile(
    user_id: str,
    updates: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    values = updates.model_dump(exclude_unset=True)
    if "email" in values:
        duplicate = db.query(User).filter(User.email == values["email"], User.id != user.id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Email already exists")
        user.email = values["email"]
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile is None:
        profile = Profile(id=uuid4(), user_id=user.id)
        db.add(profile)
    for field in ("full_name", "department_id", "company_id"):
        if field in values:
            setattr(profile, field, values[field])
    if "roles" in values and values["roles"] is not None:
        new_roles = values["roles"]
        invalid_roles = set(new_roles) - VALID_ROLES
        if invalid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role: {sorted(invalid_roles)[0]}")
        _ensure_admin_survives(
            db, user, will_be_active=user.is_active, will_be_admin="admin" in new_roles, actor=current_user
        )
        db.query(UserRole).filter(UserRole.user_id == user.id).delete()
        role_rows = {role.name: role for role in db.query(Role).filter(Role.name.in_(new_roles)).all()}
        for role_name in new_roles:
            role = role_rows.get(role_name)
            if role is None:
                raise HTTPException(status_code=400, detail=f"Role is not configured: {role_name}")
            db.add(UserRole(user_id=user.id, role_id=role.id))
        user.is_superuser = "admin" in new_roles
    _audit(db, current_user, "user_updated", user, {"fields": sorted(values.keys())})
    db.commit()
    db.refresh(user)
    return _profile_response(db, user)


@router.put("/{user_id}/status", response_model=ProfileResponse)
def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_admin_survives(db, user, will_be_active=payload.is_active, will_be_admin=_is_admin(db, user), actor=current_user)
    user.is_active = payload.is_active
    _audit(db, current_user, "user_activated" if payload.is_active else "user_deactivated", user)
    db.commit()
    return _profile_response(db, user)


@router.put("/{user_id}/password")
def reset_user_password(
    user_id: str,
    payload: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(payload.password)
    _audit(db, current_user, "user_password_reset", user)
    db.commit()
    return {"detail": "Password updated"}


@router.delete("/{user_id}")
def delete_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete the current user")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_admin_survives(db, user, will_be_active=False, will_be_admin=False, actor=current_user)
    _audit(db, current_user, "user_deleted", user)
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


@router.get("", response_model=List[ProfileResponse])
@router.get("/", response_model=List[ProfileResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    return [_profile_response(db, user) for user in db.query(User).order_by(User.created_at.desc()).all()]


@router.put("/{user_id}/roles")
def update_user_roles(
    user_id: str,
    roles: List[str] = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    invalid_roles = set(roles) - VALID_ROLES
    if invalid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {sorted(invalid_roles)[0]}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _ensure_admin_survives(db, user, will_be_active=user.is_active, will_be_admin="admin" in roles, actor=current_user)
    db.query(UserRole).filter(UserRole.user_id == user.id).delete()
    role_rows = {role.name: role for role in db.query(Role).filter(Role.name.in_(roles)).all()}
    for role_name in roles:
        role = role_rows.get(role_name)
        if role is None:
            raise HTTPException(status_code=400, detail=f"Role is not configured: {role_name}")
        db.add(UserRole(user_id=user.id, role_id=role.id))
    user.is_superuser = "admin" in roles
    _audit(db, current_user, "user_roles_updated", user, {"roles": roles})
    db.commit()
    return {"detail": "Roles updated"}
