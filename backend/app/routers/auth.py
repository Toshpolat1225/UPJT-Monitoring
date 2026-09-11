from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token, get_user_roles, verify_password
from app.models.user import User
from app.schemas.schemas import UserLogin, Token, ProfileResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not user.is_active or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user=ProfileResponse(
            id=str(user.id),
            full_name=None,
            email=user.email,
            department_id=None,
            company_id=None,
            roles=get_user_roles(db, str(user.id)),
            is_active=user.is_active,
            created_at=user.created_at,
        ),
    )
