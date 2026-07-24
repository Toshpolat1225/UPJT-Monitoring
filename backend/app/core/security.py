from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt
from passlib.context import CryptContext
from app.core.config.settings import get_settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)


def create_jwt_token(
    subject: Any, expires_delta: timedelta, token_type: str
) -> str:
    """
    Creates a JWT token (Access or Refresh).
    """
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": token_type,
    }
    encoded_jwt = jwt.encode(
        to_encode, settings.jwt.SECRET_KEY, algorithm=settings.jwt.ALGORITHM
    )
    return encoded_jwt


def create_access_token(subject: Any) -> str:
    return create_jwt_token(subject, timedelta(minutes=settings.jwt.ACCESS_TOKEN_EXPIRE_MINUTES), "access")


def create_refresh_token(subject: Any) -> str:
    # Refresh token expiry can be configured separately
    return create_jwt_token(subject, timedelta(days=7), "refresh")
