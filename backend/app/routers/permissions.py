from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.models.permission_matrix import PermissionMatrix
from app.models.user import Profile
from app.schemas.permission_matrix import PermissionMatrixCreate, PermissionMatrixRead, PermissionMatrixUpdate

router = APIRouter(prefix="/api/permissions", tags=["permissions"])


@router.get("/role-permissions", response_model=List[PermissionMatrixRead])
def list_role_permissions(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    return db.query(PermissionMatrix).order_by(PermissionMatrix.role, PermissionMatrix.module, PermissionMatrix.permission).all()


@router.post("/role-permissions", response_model=PermissionMatrixRead, status_code=status.HTTP_201_CREATED)
def create_or_update_role_permission(
    payload: PermissionMatrixCreate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    row = (
        db.query(PermissionMatrix)
        .filter(
            PermissionMatrix.role == payload.role,
            PermissionMatrix.module == payload.module,
            PermissionMatrix.permission == payload.permission,
        )
        .first()
    )

    if row is None:
        row = PermissionMatrix(
            role=payload.role,
            module=payload.module,
            permission=payload.permission,
            allowed=payload.allowed,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    row.allowed = payload.allowed
    db.commit()
    db.refresh(row)
    return row


@router.put("/role-permissions/{id}", response_model=PermissionMatrixRead)
def update_role_permission(
    id: str,
    updates: PermissionMatrixUpdate,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin")),
):
    row = db.query(PermissionMatrix).filter(PermissionMatrix.id == id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission matrix row not found")

    if updates.allowed is not None:
        row.allowed = updates.allowed

    db.commit()
    db.refresh(row)
    return row
