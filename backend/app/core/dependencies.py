from typing import List

from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import oauth2_scheme
from app.database.session import get_db
from app.models.user import Profile, UserRole

__all__ = [
    "get_db",
    "get_current_user",
    "get_user_roles",
    "require_role",
]


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Profile:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(Profile).filter(Profile.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_user_roles(db: Session, user_id: str) -> List[str]:
    return [r.role for r in db.query(UserRole).filter(UserRole.user_id == user_id).all()]


def require_role(*roles: str):
    def role_checker(
        current_user: Profile = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> Profile:
        user_roles = get_user_roles(db, str(current_user.id))
        if not any(r in roles for r in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker
