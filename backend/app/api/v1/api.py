from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.products import router as products_router
from app.api.v1.endpoints.profile import router as profile_router
from app.api.v1.endpoints.shops import router as shops_router
from app.api.v1.endpoints.vendors import router as vendors_router
from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.customers import router as customers_router
from app.api.v1.endpoints.billing import router as billing_router
from app.api.v1.endpoints.invoices import router as invoices_router
from app.api.v1.endpoints.expenses import router as expenses_router
from app.api.v1.endpoints.reports import router as reports_router
from app.api.v1.endpoints.admin import router as admin_router
from app.api.v1.endpoints.subscription import router as subscription_router
from app.api.v1.endpoints.audit_logs import router as audit_logs_router
from app.api.v1.endpoints.inventory import router as inventory_router
from app.api.v1.endpoints.purchase_orders import router as purchase_orders_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(products_router)
api_router.include_router(profile_router)
api_router.include_router(shops_router)
api_router.include_router(vendors_router)
api_router.include_router(customers_router)
api_router.include_router(billing_router)
api_router.include_router(invoices_router)
api_router.include_router(dashboard_router)
api_router.include_router(expenses_router)
api_router.include_router(reports_router)
api_router.include_router(admin_router)
api_router.include_router(subscription_router)
api_router.include_router(audit_logs_router)
api_router.include_router(inventory_router)
api_router.include_router(purchase_orders_router)
