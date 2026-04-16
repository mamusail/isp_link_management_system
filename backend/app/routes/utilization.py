from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date
from app.database import SessionLocal
from app.models.utilization import LinkUtilization
from app.models.link import Link

router = APIRouter(prefix="/utilization", tags=["Utilization"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UtilUpdate(BaseModel):
    link_id:       int
    max_util_mbps: float
    updated_by:    Optional[str] = None
    period_from:   Optional[date] = None
    period_to:     Optional[date] = None

class UtilOut(BaseModel):
    id:            int
    link_id:       int
    max_util_mbps: Optional[float] = None
    period_from:   Optional[date] = None
    period_to:     Optional[date] = None
    updated_at:    Optional[datetime] = None
    updated_by:    Optional[str] = None
    class Config:
        from_attributes = True

@router.get("/", response_model=list[UtilOut])
def get_all(db: Session = Depends(get_db)):
    return db.query(LinkUtilization).all()

@router.post("/", response_model=UtilOut)
def upsert_util(data: UtilUpdate, db: Session = Depends(get_db)):
    link = db.query(Link).filter(Link.id == data.link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    existing = db.query(LinkUtilization).filter(LinkUtilization.link_id == data.link_id).first()
    if existing:
        existing.max_util_mbps = data.max_util_mbps
        existing.updated_by    = data.updated_by
        existing.period_from   = data.period_from
        existing.period_to     = data.period_to
        existing.updated_at    = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        new = LinkUtilization(
            link_id=data.link_id,
            max_util_mbps=data.max_util_mbps,
            updated_by=data.updated_by,
            period_from=data.period_from,
            period_to=data.period_to,
        )
        db.add(new)
        db.commit()
        db.refresh(new)
        return new