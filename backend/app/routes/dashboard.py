from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app.models.link import Link

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def get_dashboard(db: Session = Depends(get_db)):

    total_links = db.query(func.count(Link.id)).scalar()

    active_links = db.query(func.count(Link.id)).filter(Link.status == "active").scalar()

    down_links = db.query(func.count(Link.id)).filter(Link.status == "down").scalar()

    total_bandwidth = db.query(func.sum(Link.quantity_mbps)).scalar()

    return {
        "total_links": total_links or 0,
        "active_links": active_links or 0,
        "down_links": down_links or 0,
        "total_bandwidth_mbps": total_bandwidth or 0
    }