from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import SessionLocal
from app.models.partner import Partner
from app.models.kam import KAM
from app.models.user import User
from app.auth import hash_password

router = APIRouter(prefix="/partners", tags=["Partners"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class PartnerCreate(BaseModel):
    username:   str
    password:   str
    partner_id: str
    name:       str
    mobile:     Optional[str] = None
    address:    Optional[str] = None
    kam_id:     Optional[int] = None  # FK to kams.id

class PartnerOut(BaseModel):
    id:         int
    partner_id: str
    name:       str
    mobile:     Optional[str] = None
    address:    Optional[str] = None
    kam_id:     Optional[int] = None
    kam_name:   Optional[str] = None
    user_id:    int
    username:   Optional[str] = None
    class Config:
        from_attributes = True

class PartnerUpdate(BaseModel):
    name:    Optional[str] = None
    mobile:  Optional[str] = None
    address: Optional[str] = None
    kam_id:  Optional[int] = None

def enrich(p: Partner, db: Session) -> PartnerOut:
    user = db.query(User).filter(User.id == p.user_id).first()
    kam  = db.query(KAM).filter(KAM.id == p.kam_id).first() if p.kam_id else None
    return PartnerOut(id=p.id, partner_id=p.partner_id, name=p.name,
                      mobile=p.mobile, address=p.address, kam_id=p.kam_id,
                      kam_name=kam.name if kam else None,
                      user_id=p.user_id, username=user.username if user else None)

@router.get("/", response_model=list[PartnerOut])
def get_partners(db: Session = Depends(get_db)):
    return [enrich(p, db) for p in db.query(Partner).all()]

@router.post("/", response_model=PartnerOut)
def create_partner(data: PartnerCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(Partner).filter(Partner.partner_id == data.partner_id).first():
        raise HTTPException(status_code=400, detail="Partner ID already exists")

    user = User(username=data.username, password=hash_password(data.password), role="PARTNER")
    db.add(user); db.commit(); db.refresh(user)

    partner = Partner(partner_id=data.partner_id, name=data.name, mobile=data.mobile,
                      address=data.address, kam_id=data.kam_id, user_id=user.id)
    db.add(partner); db.commit(); db.refresh(partner)
    return enrich(partner, db)

@router.put("/{id}", response_model=PartnerOut)
def update_partner(id: int, data: PartnerUpdate, db: Session = Depends(get_db)):
    p = db.query(Partner).filter(Partner.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Partner not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return enrich(p, db)

@router.delete("/{id}")
def delete_partner(id: int, db: Session = Depends(get_db)):
    p = db.query(Partner).filter(Partner.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Partner not found")
    user = db.query(User).filter(User.id == p.user_id).first()
    if user: db.delete(user)
    db.delete(p); db.commit()
    return {"message": "Deleted"}