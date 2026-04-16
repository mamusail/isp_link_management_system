from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class POP(Base):
    __tablename__ = "pops"

    id       = Column(Integer, primary_key=True, index=True)
    pop_id   = Column(String, unique=True, index=True)
    name     = Column(String)
    operator = Column(String, nullable=True)   # "AKN" | "BTL"
    type     = Column(String)
    lat      = Column(Float, nullable=True)
    lng      = Column(Float, nullable=True)
    notes    = Column(String, nullable=True)