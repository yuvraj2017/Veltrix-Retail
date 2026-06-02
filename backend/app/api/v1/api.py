from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.products import router as products_router
from app.api.v1.endpoints.profile import router as profile_router
from app.api.v1.endpoints.vendors import router as vendors_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.customers import router as customers_router
from app.api.v1.endpoints.billing import router as billing_router
from app.api.v1.endpoints.invoices import router as invoices_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(products_router)
api_router.include_router(profile_router)
api_router.include_router(vendors_router)
api_router.include_router(customers_router)
api_router.include_router(billing_router)
api_router.include_router(invoices_router)
api_router.include_router(dashboard_router)