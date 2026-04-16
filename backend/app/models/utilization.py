from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, Date
from sqlalchemy.sql import func
from app.database import Base

class LinkUtilization(Base):
    __tablename__ = "link_utilization"

    id              = Column(Integer, primary_key=True, index=True)
    link_id         = Column(Integer, ForeignKey("links.id", ondelete="CASCADE"), nullable=False, index=True)
    max_util_mbps   = Column(Float, nullable=True)
    period_from     = Column(Date, nullable=True)
    period_to       = Column(Date, nullable=True)
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    updated_by      = Column(String, nullable=True)