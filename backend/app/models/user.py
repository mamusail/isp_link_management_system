from sqlalchemy import Column, Integer, String, Enum
import enum
from app.database import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    NOC = "NOC"
    KAM = "KAM"
    ACCOUNTS = "ACCOUNTS"
    CLIENT = "CLIENT"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String, unique=True, index=True)
    password = Column(String)

    role = Column(Enum(RoleEnum))