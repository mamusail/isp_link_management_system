from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date, timedelta
from app.database import SessionLocal
from app.models.link_request import LinkRequest
from app.models.link import Link

router = APIRouter(prefix="/requests", tags=["Requests"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Schemas ────────────────────────────────────────────────────────
class RequestCreate(BaseModel):
    link_id:        int
    request_type:   str          # UPGRADE | DOWNGRADE | TERMINATE
    change_mbps:    Optional[int] = None
    requested_by:   str
    requested_role: str          # NOC | PARTNER

class BillingAction(BaseModel):
    action:       str            # APPROVE | CANCEL
    billing_by:   str
    billing_note: Optional[str] = None

class AdminAction(BaseModel):
    action:    str               # CONFIRM | REJECT
    admin_by:  str
    admin_note: Optional[str] = None

class RequestOut(BaseModel):
    id:              int
    link_id:         int
    request_type:    str
    change_mbps:     Optional[int] = None
    requested_by:    str
    requested_role:  str
    effective_date:  Optional[date] = None
    status:          str
    billing_note:    Optional[str] = None
    billing_by:      Optional[str] = None
    billing_at:      Optional[datetime] = None
    admin_note:      Optional[str] = None
    admin_by:        Optional[str] = None
    admin_at:        Optional[datetime] = None
    created_at:      Optional[datetime] = None
    class Config:
        from_attributes = True

# ── GET all requests ───────────────────────────────────────────────
@router.get("/", response_model=list[RequestOut])
def get_requests(db: Session = Depends(get_db)):
    return db.query(LinkRequest).order_by(LinkRequest.created_at.desc()).all()

# ── GET requests for a specific link ──────────────────────────────
@router.get("/link/{link_id}", response_model=list[RequestOut])
def get_link_requests(link_id: int, db: Session = Depends(get_db)):
    return db.query(LinkRequest).filter(
        LinkRequest.link_id == link_id
    ).order_by(LinkRequest.created_at.desc()).all()

# ── CREATE request ─────────────────────────────────────────────────
@router.post("/", response_model=RequestOut)
def create_request(data: RequestCreate, db: Session = Depends(get_db)):
    link = db.query(Link).filter(Link.id == data.link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    # Validate change_mbps required for UPGRADE/DOWNGRADE
    if data.request_type in ("UPGRADE", "DOWNGRADE") and not data.change_mbps:
        raise HTTPException(status_code=400, detail="change_mbps required for UPGRADE/DOWNGRADE")

    # Partner 30-day rule for DOWNGRADE and TERMINATE
    effective_date = date.today()
    if data.requested_role == "PARTNER" and data.request_type in ("DOWNGRADE", "TERMINATE"):
        effective_date = date.today() + timedelta(days=30)

    req = LinkRequest(
        link_id=data.link_id,
        request_type=data.request_type,
        change_mbps=data.change_mbps,
        requested_by=data.requested_by,
        requested_role=data.requested_role,
        effective_date=effective_date,
        status="BILLING_PENDING",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

# ── BILLING action ─────────────────────────────────────────────────
@router.put("/{req_id}/billing", response_model=RequestOut)
def billing_action(req_id: int, data: BillingAction, db: Session = Depends(get_db)):
    req = db.query(LinkRequest).filter(LinkRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "BILLING_PENDING":
        raise HTTPException(status_code=400, detail="Request is not in BILLING_PENDING state")

    if data.action == "APPROVE":
        req.status     = "ADMIN_PENDING"
        req.billing_by = data.billing_by
        req.billing_at = datetime.now(timezone.utc)
    elif data.action == "CANCEL":
        if not data.billing_note:
            raise HTTPException(status_code=400, detail="billing_note is required when cancelling")
        req.status       = "CANCELLED"
        req.billing_by   = data.billing_by
        req.billing_note = data.billing_note
        req.billing_at   = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="action must be APPROVE or CANCEL")

    db.commit()
    db.refresh(req)
    return req

# ── ADMIN action ───────────────────────────────────────────────────
@router.put("/{req_id}/admin", response_model=RequestOut)
def admin_action(req_id: int, data: AdminAction, db: Session = Depends(get_db)):
    req = db.query(LinkRequest).filter(LinkRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "ADMIN_PENDING":
        raise HTTPException(status_code=400, detail="Request is not in ADMIN_PENDING state")

    if data.action == "CONFIRM":
        req.status   = "CONFIRMED"
        req.admin_by = data.admin_by
        req.admin_at = datetime.now(timezone.utc)

        # Apply link change
        link = db.query(Link).filter(Link.id == req.link_id).first()
        if link:
            if req.request_type == "UPGRADE":
                link.quantity_mbps = (link.quantity_mbps or 0) + req.change_mbps
            elif req.request_type == "DOWNGRADE":
                link.quantity_mbps = max(0, (link.quantity_mbps or 0) - req.change_mbps)
            elif req.request_type == "TERMINATE":
                link.status = "CANCELLED"

    elif data.action == "REJECT":
        req.status    = "REJECTED"
        req.admin_by  = data.admin_by
        req.admin_note = data.admin_note
        req.admin_at  = datetime.now(timezone.utc)
    else:
        raise HTTPException(status_code=400, detail="action must be CONFIRM or REJECT")

    db.commit()
    db.refresh(req)
    return req