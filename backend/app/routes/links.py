from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import SessionLocal
from app.models.link import Link
from app import schemas

router = APIRouter(prefix="/links", tags=["Links"])


# =========================
# DATABASE SESSION
# =========================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# CREATE LINK
# =========================
@router.post("/", response_model=schemas.Link)
def create_link(
    link: schemas.LinkCreate,
    db: Session = Depends(get_db)
):
    db_link = Link(**link.dict())
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link


# =========================
# GET ALL LINKS
# =========================
@router.get("/", response_model=list[schemas.Link])
def get_links(
    owner: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Link)

    # FILTERS
    if owner:
        query = query.filter(Link.owner == owner)


    if status:
        query = query.filter(Link.status == status)

    # SEARCH (partial match)
    if search:
        query = query.filter(Link.link_id.ilike(f"%{search}%"))

    return query.all()


# =========================
# GET SINGLE LINK
# =========================
@router.get("/{id}", response_model=schemas.Link)
def get_link(
    id: int,
    db: Session = Depends(get_db)
):
    link = db.query(Link).filter(Link.id == id).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    return link


# =========================
# UPDATE LINK
# =========================
@router.put("/{id}", response_model=schemas.Link)
def update_link(
    id: int,
    updated: schemas.LinkUpdate,
    db: Session = Depends(get_db)
):
    link = db.query(Link).filter(Link.id == id).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    for key, value in updated.dict().items():
        setattr(link, key, value)

    db.commit()
    db.refresh(link)

    return link


# =========================
# DELETE LINK
# =========================
@router.delete("/{id}")
def delete_link(
    id: int,
    db: Session = Depends(get_db)
):
    link = db.query(Link).filter(Link.id == id).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()

    return {"message": "Deleted successfully"}