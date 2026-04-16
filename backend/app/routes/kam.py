from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import SessionLocal
from app.models.kam import KAM
from app.models.user import User
from app.auth import hash_password

router = APIRouter(prefix="/kams", tags=["KAMs"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class KAMCreate(BaseModel):
    # Login credentials
    username: str
    password: str
    # Profile
    kam_id:  str
    name:    str
    mobile:  Optional[str] = None
    nid:     Optional[str] = None
    address: Optional[str] = None

class KAMOut(BaseModel):
    id:       int
    kam_id:   str
    name:     str
    mobile:   Optional[str] = None
    nid:      Optional[str] = None
    address:  Optional[str] = None
    user_id:  int
    username: Optional[str] = None
    class Config:
        from_attributes = True

class KAMUpdate(BaseModel):
    name:    Optional[str] = None
    mobile:  Optional[str] = None
    nid:     Optional[str] = None
    address: Optional[str] = None

@router.get("/", response_model=list[KAMOut])
def get_kams(db: Session = Depends(get_db)):
    kams = db.query(KAM).all()
    result = []
    for k in kams:
        user = db.query(User).filter(User.id == k.user_id).first()
        out = KAMOut(id=k.id, kam_id=k.kam_id, name=k.name, mobile=k.mobile,
                     nid=k.nid, address=k.address, user_id=k.user_id,
                     username=user.username if user else None)
        result.append(out)
    return result

@router.post("/", response_model=KAMOut)
def create_kam(data: KAMCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(KAM).filter(KAM.kam_id == data.kam_id).first():
        raise HTTPException(status_code=400, detail="KAM ID already exists")

    user = User(username=data.username, password=hash_password(data.password), role="KAM")
    db.add(user); db.commit(); db.refresh(user)

    kam = KAM(kam_id=data.kam_id, name=data.name, mobile=data.mobile,
              nid=data.nid, address=data.address, user_id=user.id)
    db.add(kam); db.commit(); db.refresh(kam)

    return KAMOut(id=kam.id, kam_id=kam.kam_id, name=kam.name, mobile=kam.mobile,
                  nid=kam.nid, address=kam.address, user_id=kam.user_id, username=user.username)

@router.put("/{id}", response_model=KAMOut)
def update_kam(id: int, data: KAMUpdate, db: Session = Depends(get_db)):
    kam = db.query(KAM).filter(KAM.id == id).first()
    if not kam:
        raise HTTPException(status_code=404, detail="KAM not found")
    for k, v in data.dict(exclude_none=True).items():
        setattr(kam, k, v)
    db.commit(); db.refresh(kam)
    user = db.query(User).filter(User.id == kam.user_id).first()
    return KAMOut(id=kam.id, kam_id=kam.kam_id, name=kam.name, mobile=kam.mobile,
                  nid=kam.nid, address=kam.address, user_id=kam.user_id,
                  username=user.username if user else None)

@router.delete("/{id}")
def delete_kam(id: int, db: Session = Depends(get_db)):
    kam = db.query(KAM).filter(KAM.id == id).first()
    if not kam:
        raise HTTPException(status_code=404, detail="KAM not found")
    user = db.query(User).filter(User.id == kam.user_id).first()
    if user: db.delete(user)
    db.delete(kam); db.commit()
    return {"message": "Deleted"}