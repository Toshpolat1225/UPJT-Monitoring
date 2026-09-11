from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.audit_log import AuditLog
from app.models.user import Profile
from app.schemas.audit_log import AuditLogRead

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/audit-log", response_model=List[AuditLogRead])
def list_audit_logs(
    user_id: Optional[str] = Query(None),
    table_name: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_role("admin", "gsm", "operator")),
):
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)

    return query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
