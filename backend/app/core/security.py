from datetime import datetime, timedelta, timezone
from typing import Optional, List
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserRole, Role

from passlib.context import CryptContext

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    issued_at = datetime.now(timezone.utc)
    expire = issued_at + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"iat": issued_at, "exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if user is None:
        raise credentials_exception
    return user


def get_user_roles(db: Session, user_id: str) -> List[str]:
    return [role_name for (role_name,) in db.query(Role.name).join(UserRole, UserRole.role_id == Role.id).filter(UserRole.user_id == user_id).all()]


def require_role(*roles: str):
    def role_checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_roles = get_user_roles(db, str(current_user.id))
        if not any(r in roles for r in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return role_checker
