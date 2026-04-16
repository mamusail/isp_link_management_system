from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base

class Partner(Base):
    __tablename__ = "partners"

    id         = Column(Integer, primary_key=True, index=True)
    partner_id = Column(String, unique=True, index=True)  # PTR-001
    name       = Column(String, nullable=False)
    mobile     = Column(String, nullable=True)
    address    = Column(String, nullable=True)
    kam_id     = Column(Integer, ForeignKey("kams.id", ondelete="SET NULL"), nullable=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True)