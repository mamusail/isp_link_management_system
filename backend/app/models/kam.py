from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class KAM(Base):
    __tablename__ = "kams"

    id      = Column(Integer, primary_key=True, index=True)
    kam_id  = Column(String, unique=True, index=True)   # KAM-001
    name    = Column(String, nullable=False)
    mobile  = Column(String, nullable=True)
    nid     = Column(String, nullable=True)
    address = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)