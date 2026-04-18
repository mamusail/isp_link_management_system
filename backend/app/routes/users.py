from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app import schemas
from app.auth import hash_password
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["Users"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 🔵 CREATE USER (with password hashing)
@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    
    # check if user already exists
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # hash password
    hashed_password = hash_password(user.password)

    new_user = User(
        username=user.username,
        password=hashed_password,
        role=user.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# 🔵 GET ALL USERS
@router.get("/", response_model=list[schemas.User])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).all()


# 🟡 UPDATE USER
class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[schemas.RoleEnum] = None

@router.put("/{user_id}", response_model=schemas.User)
def update_user(user_id: int, data: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.username is not None:
        conflict = db.query(User).filter(User.username == data.username, User.id != user_id).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Username already exists")
        user.username = data.username

    if data.role is not None:
        user.role = data.role

    if data.password:
        user.password = hash_password(data.password)

    db.commit()
    db.refresh(user)
    return user


# 🔴 DELETE USER
@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}