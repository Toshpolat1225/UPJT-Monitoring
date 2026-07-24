from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
import re


async def integrity_error_handler(request: Request, exc: IntegrityError):
    """
    Handles SQLAlchemy IntegrityError, turning them into a user-friendly
    409 Conflict response.
    """
    # Log the original error for debugging
    # logger.error(f"Integrity error: {exc.orig}")

    # Try to extract a meaningful message from the error
    detail = "A database integrity error occurred."
    if exc.orig:
        match = re.search(r'DETAIL:\s*(.*)', str(exc.orig))
        if match:
            detail = match.group(1).strip()
            # Prettify common messages
            if 'already exists' in detail:
                key_match = re.search(r'Key \((.*?)\)=\((.*?)\)', detail)
                if key_match:
                    field, value = key_match.groups()
                    detail = f"An entry with {field} '{value}' already exists."

    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": detail},
    )