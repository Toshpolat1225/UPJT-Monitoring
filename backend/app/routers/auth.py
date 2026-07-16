from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import Profile, UserRole
from app.schemas.schemas import UserLogin, Token, ProfileResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    # In production, verify against Supabase auth or your auth provider
    # This is a placeholder for the FastAPI backend artifact
    profile = db.query(Profile).filter(Profile.email == credentials.email).first()
    if not profile:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(profile.id)})
    return Token(access_token=token, token_type="bearer", user=ProfileResponse.model_validate(profile))
