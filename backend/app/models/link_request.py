from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date
from sqlalchemy.sql import func
from app.database import Base

class LinkRequest(Base):
    __tablename__ = "link_requests"

    id               = Column(Integer, primary_key=True, index=True)
    link_id          = Column(Integer, ForeignKey("links.id", ondelete="CASCADE"), nullable=False, index=True)

    request_type     = Column(String, nullable=False)   # UPGRADE | DOWNGRADE | TERMINATE
    change_mbps      = Column(Integer, nullable=True)   # +/- Mbps (null for TERMINATE)
    requested_by     = Column(String, nullable=False)   # username
    requested_role   = Column(String, nullable=False)   # NOC | PARTNER
    effective_date   = Column(Date, nullable=True)      # for partner 30-day rule

    status           = Column(String, default="BILLING_PENDING")
    # BILLING_PENDING → ADMIN_PENDING → CONFIRMED | REJECTED
    #                 → CANCELLED (by billing)

    billing_note     = Column(String, nullable=True)    # required on cancel
    billing_by       = Column(String, nullable=True)
    billing_at       = Column(DateTime(timezone=True), nullable=True)

    admin_note       = Column(String, nullable=True)
    admin_by         = Column(String, nullable=True)
    admin_at         = Column(DateTime(timezone=True), nullable=True)

    created_at       = Column(DateTime(timezone=True), server_default=func.now())