from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_active_user
from app.schemas.user import UserRead
from app.services.auth_service import AuthService


async def get_user_permissions(
    current_user: Annotated[UserRead, Depends(get_current_active_user)],
    auth_service: Annotated[AuthService, Depends()],
):
    """
    Dependency that fetches all permissions for the current user.
    This can be cached in a future step.
    """
    permissions = await auth_service.get_user_permissions(user_id=current_user.id)
    if not permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User has no assigned permissions.",
        )
    return permissions


class PermissionChecker:
    def __init__(self, required_permission: str):
        self.required_permission = required_permission

    async def __call__(
        self,
        user_permissions: Annotated[dict, Depends(get_user_permissions)],
    ):
        """
        Checks if the user has the required permission.
        """
        if user_permissions.get("is_superuser"):
            return

        if self.required_permission not in user_permissions.get("permissions", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{self.required_permission}' required.",
            )


RequirePermission = PermissionChecker