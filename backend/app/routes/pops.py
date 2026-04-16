from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import SessionLocal
from app.models.pop import POP

router = APIRouter(prefix="/pops", tags=["POPs"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class POPCreate(BaseModel):
    operator: str
    pop_id: str
    name: str
    type: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None

class POPUpdate(BaseModel):
    operator: Optional[str] = None
    pop_id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None

class POPOut(BaseModel):
    id: int
    operator: Optional[str] = None
    pop_id: str
    name: str
    type: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    notes: Optional[str] = None
    class Config:
        from_attributes = True

@router.get("/", response_model=list[POPOut])
def get_pops(db: Session = Depends(get_db)):
    return db.query(POP).all()

@router.post("/", response_model=POPOut)
def create_pop(pop: POPCreate, db: Session = Depends(get_db)):
    db_pop = POP(**pop.dict())
    db.add(db_pop)
    db.commit()
    db.refresh(db_pop)
    return db_pop

@router.put("/{id}", response_model=POPOut)
def update_pop(id: int, updated: POPUpdate, db: Session = Depends(get_db)):
    pop = db.query(POP).filter(POP.id == id).first()
    if not pop:
        raise HTTPException(status_code=404, detail="POP not found")
    for k, v in updated.dict(exclude_none=True).items():
        setattr(pop, k, v)
    db.commit()
    db.refresh(pop)
    return pop

@router.delete("/{id}")
def delete_pop(id: int, db: Session = Depends(get_db)):
    pop = db.query(POP).filter(POP.id == id).first()
    if not pop:
        raise HTTPException(status_code=404, detail="POP not found")
    db.delete(pop)
    db.commit()
    return {"message": "Deleted"}