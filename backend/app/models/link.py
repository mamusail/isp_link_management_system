from sqlalchemy import Column, Integer, String, Date, Enum, ForeignKey
import enum
from app.database import Base


class OwnerEnum(str, enum.Enum):
    AKN = "AKN"
    BTL = "BTL"


class Link(Base):
    __tablename__ = "links"

    id                  = Column(Integer, primary_key=True, index=True)
    owner               = Column(Enum(OwnerEnum))
    link_id             = Column(String, unique=True, index=True)
    type                = Column(String, nullable=True)
    aggregation         = Column(String, nullable=True)
    to_location         = Column(String)
    quantity_mbps       = Column(Integer, nullable=True)
    commissioning_date  = Column(Date, nullable=True)
    status              = Column(String)
    notes               = Column(String, nullable=True)
    vlan                = Column(String, nullable=True)
    partner_id          = Column(Integer, ForeignKey("partners.id", ondelete="SET NULL"), nullable=True)
    link_category       = Column(String, nullable=True)  # MAC | Corporate