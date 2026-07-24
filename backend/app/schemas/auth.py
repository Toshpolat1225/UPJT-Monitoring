from pydantic import BaseModel, UUID4, EmailStr

from .user import UserRead


class LoginRequest(BaseModel):
    """Schema for user login request."""
    email: EmailStr
    password: str


class Token(BaseModel):
    """Schema for access and refresh tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Schema for token payload data."""
    sub: UUID4 | None = None
    type: str | None = None


class LoginResponse(BaseModel):
    """
    Schema for the response after a successful login.
    Designed to be compatible with the existing frontend contract.
    """
    token: Token
    user: UserRead


class RefreshRequest(BaseModel):
    """Schema for token refresh request."""
    refresh_token: str