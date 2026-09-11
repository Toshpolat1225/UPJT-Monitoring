from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie

from app.dependencies.auth import get_current_active_user
from app.dependencies.permissions import RequirePermission
from app.schemas.auth import LoginRequest, LoginResponse, Token
from app.schemas.user import UserRead
from app.services.auth_service import AuthService
from app.services.token_service import TokenService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
async def login_for_access_token(
    response: Response,
    form_data: LoginRequest,
    auth_service: Annotated[AuthService, Depends()],
):
    login_data = await auth_service.authenticate_user(
        email=form_data.email, password=form_data.password
    )
    if not login_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # HttpOnly cookie o'rnatish
    response.set_cookie(
        key="refresh_token",
        value=login_data.token.refresh_token,
        httponly=True,
        secure=True,  # Production (HTTPS) uchun True
        samesite="strict",
        max_age=7 * 24 * 3600,
        path="/api/v1/auth",
    )

    login_data.token.refresh_token = ""  # Body orqali yubormaymiz
    return login_data


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    response: Response,
    refresh_token: Annotated[str | None, Cookie()] = None,
    token_service: Annotated[TokenService, Depends()] = None,
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found in cookies"
        )

    new_access_token, new_refresh_token = await token_service.rotate_refresh_token(refresh_token)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 24 * 3600,
        path="/api/v1/auth"
    )

    return Token(access_token=new_access_token, token_type="bearer", refresh_token="")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token: Annotated[str | None, Cookie()] = None,
    token_service: Annotated[TokenService, Depends()] = None,
):
    if refresh_token:
        await token_service.revoke_token(refresh_token)

    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    return None


@router.get("/me", response_model=UserRead, dependencies=[Depends(RequirePermission("profile.read"))])
async def read_users_me(
    current_user: Annotated[UserRead, Depends(get_current_active_user)]
):
    return current_user
