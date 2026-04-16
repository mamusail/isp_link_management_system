from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base

# Models - ALL SINGULAR (matching your models folder)
from app.models.link import Link
from app.models.pop import POP
from app.models.user import User
from app.models.utilization import LinkUtilization
from app.models.link_request import LinkRequest
from app.models.kam import KAM
from app.models.partner import Partner

# Routes - ALL PLURAL (matching your routes folder), kam stays as kam
from app.routes import links, dashboard, pops, users, auth, utilization, requests, kam, partners

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

Base.metadata.create_all(bind=engine)

app.include_router(links.router)
app.include_router(dashboard.router)
app.include_router(pops.router)
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(utilization.router)
app.include_router(requests.router)
app.include_router(kam.router)
app.include_router(partners.router)

@app.get("/")
def home():
    return {"message": "ISP Link Management System running"}