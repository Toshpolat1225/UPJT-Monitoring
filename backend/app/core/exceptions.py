from fastapi import Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError
import re
import logging

logger = logging.getLogger(__name__)

class CustomException(Exception):
    def __init__(self, status_code: int, error_code: str, message: str, details: dict = None):
        self.status_code = status_code
        self.error_code = error_code
        self.message = message
        self.details = details if details is not None else {}
        super().__init__(self.message)

class ValidationException(CustomException):
    def __init__(self, message: str = "Validation failed", details: dict = None):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", message, details)

class PermissionDeniedException(CustomException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(status.HTTP_403_FORBIDDEN, "PERMISSION_DENIED", message)

class BusinessRuleException(CustomException):
    def __init__(self, message: str = "Business rule violation", details: dict = None):
        super().__init__(status.HTTP_400_BAD_REQUEST, "BUSINESS_RULE_ERROR", message, details)

class DuplicateException(CustomException):
    def __init__(self, message: str = "Resource already exists", details: dict = None):
        super().__init__(status.HTTP_409_CONFLICT, "DUPLICATE_ERROR", message, details)

class NotFoundException(CustomException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(status.HTTP_404_NOT_FOUND, "NOT_FOUND", message)

class ConflictException(CustomException):
    def __init__(self, message: str = "Conflict occurred", details: dict = None):
        super().__init__(status.HTTP_409_CONFLICT, "CONFLICT_ERROR", message, details)

class InventoryException(CustomException):
    def __init__(self, message: str = "Inventory operation failed", details: dict = None):
        super().__init__(status.HTTP_400_BAD_REQUEST, "INVENTORY_ERROR", message, details)

async def custom_exception_handler(request: Request, exc: CustomException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code,
            "request_id": getattr(request.state, "request_id", "N/A"),
            "details": exc.details,
        },
    )


async def integrity_error_handler(request: Request, exc: IntegrityError):
    """
    Handles SQLAlchemy IntegrityError, turning them into a user-friendly
    409 Conflict response.
    """
    logger.error(f"Integrity error: {exc.orig}", exc_info=True, extra={"request_id": getattr(request.state, "request_id", "N/A")})

    # Try to extract a meaningful message from the error
    detail = "A database integrity error occurred."
    if exc.orig:
        match = re.search(r'DETAIL:\s*(.*)', str(exc.orig))
        if match:
            # Clean up the detail message
            raw_detail = match.group(1).strip()
            detail = raw_detail.split('\n')[0] # Take only the first line

            # Prettify common messages
            if 'already exists' in detail:
                key_match = re.search(r'Key \((.*?)\)=\((.*?)\)', detail)
                if key_match:
                    field, value = key_match.groups()
                    detail = f"An entry with {field} '{value}' already exists."
            elif 'is not present in table' in detail:
                detail = "Referenced record does not exist."
            elif 'violates foreign key constraint' in detail:
                detail = "Cannot delete or update a parent row: a foreign key constraint fails."

    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "success": False,
            "message": "Data conflict or duplicate entry.",
            "error_code": "DB_INTEGRITY_ERROR",
            "request_id": getattr(request.state, "request_id", "N/A"),
            "details": {"error_detail": detail},
        },
    )

async def validation_error_handler(request: Request, exc: ValidationError):
    logger.warning(f"Pydantic validation error: {exc.errors()}", extra={"request_id": getattr(request.state, "request_id", "N/A")})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Request validation failed.",
            "error_code": "PYDANTIC_VALIDATION_ERROR",
            "request_id": getattr(request.state, "request_id", "N/A"),
            "details": {"errors": exc.errors()},
        },
    )