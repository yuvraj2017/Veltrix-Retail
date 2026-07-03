import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from app import models  # noqa: F401
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import Base, engine

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

os.makedirs("uploads", exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router)


def _ensure_invoice_pricing_columns():
    Base.metadata.create_all(bind=engine)

    with engine.begin() as connection:
        inspector = inspect(connection)

        if not inspector.has_table("invoices"):
            return

        column_names = {column["name"] for column in inspector.get_columns("invoices")}

        if "billed_amount" not in column_names:
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN billed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0"
                )
            )

        if "extra_discount_amount" not in column_names:
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN extra_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0"
                )
            )

        connection.execute(
            text(
                "UPDATE invoices "
                "SET billed_amount = final_amount "
                "WHERE COALESCE(billed_amount, 0) = 0 AND COALESCE(final_amount, 0) <> 0"
            )
        )


@app.on_event("startup")
def on_startup():
    _ensure_invoice_pricing_columns()


@app.get("/health")
def health():
    return {"status": "ok"}
