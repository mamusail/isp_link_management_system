from pydantic import BaseModel
from datetime import date
from enum import Enum
from typing import Optional


class RoleEnum(str, Enum):
    ADMIN = "ADMIN"
    NOC = "NOC"
    KAM = "KAM"
    ACCOUNTS = "ACCOUNTS"
    CLIENT = "CLIENT"


class OwnerEnum(str, Enum):
    AKN = "AKN"
    BTL = "BTL"


# ================= LINK =================

class LinkBase(BaseModel):
    owner: OwnerEnum
    link_id: str
    type: Optional[str] = None
    aggregation: Optional[str] = None
    to_location: str
    quantity_mbps: Optional[int] = None
    commissioning_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    vlan: Optional[str] = None


class LinkCreate(LinkBase):
    pass


class LinkUpdate(BaseModel):
    owner: Optional[OwnerEnum] = None
    link_id: Optional[str] = None
    type: Optional[str] = None
    aggregation: Optional[str] = None
    to_location: Optional[str] = None
    quantity_mbps: Optional[int] = None
    commissioning_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    vlan: Optional[str] = None


class Link(LinkBase):
    id: int

    class Config:
        from_attributes = True


# ================= USER =================

class UserBase(BaseModel):
    username: str
    role: RoleEnum


class UserCreate(UserBase):
    password: str


class User(UserBase):
    id: int

    class Config:
        from_attributes = True