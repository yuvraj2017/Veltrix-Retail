import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.membership import MembershipRole, MembershipStatus
from app.core.security import hash_password
from app.core.user_status import UserRole, UserStatus
from app.models.invoice import Invoice
from app.models.membership import BranchMembership, OrganizationMembership
from app.models.organization import Organization
from app.models.product import Product
from app.models.purchase import GoodsReceipt, PurchaseReturn
from app.models.shop import Shop
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.invoice import InvoiceCreate
from app.schemas.product import ProductCreate
from app.schemas.purchase import (
    GoodsReceiptCreate,
    GoodsReceiptItemCreate,
    PurchaseOrderCreate,
    PurchaseOrderItemCreate,
    PurchaseReturnCreate,
    PurchaseReturnItemCreate,
)
from app.services.authorization_service import TenantRequestUser
from app.services.invoice_service import create_invoice
from app.services.product_service import create_product
from app.services.purchase_service import (
    create_goods_receipt,
    create_purchase_order,
    create_purchase_return,
)
from app.services.stock_service import reconcile_stock_balances
from app.services.subscription_service import ensure_legacy_subscription_for_shop


POSTGRES_URL = os.getenv("TEST_POSTGRES_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not POSTGRES_URL,
    reason="TEST_POSTGRES_DATABASE_URL is required for PostgreSQL release verification",
)


def _setup_multibranch_owner(Session):
    unique = uuid4().hex
    with Session() as db:
        organization = Organization(name=f"Release concurrency {unique}", status="active")
        db.add(organization)
        db.flush()
        branches = []
        for index in range(2):
            branch = Shop(
                organization_id=organization.id,
                is_default_branch=index == 0,
                name=f"Release Branch {index} {unique}",
                category="Test",
                email=f"release-branch-{index}-{unique}@example.com",
                phone=f"90000002{index:02d}",
            )
            db.add(branch)
            branches.append(branch)
        db.flush()
        user = User(
            shop_id=branches[0].id,
            full_name="Release Concurrency Owner",
            email=f"release-concurrency-owner-{unique}@example.com",
            password_hash=hash_password("StrongPassword123!"),
            role=UserRole.OWNER,
            status=UserStatus.ACTIVE,
            is_active=True,
        )
        db.add(user)
        db.flush()
        membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=user.id,
            role=MembershipRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )
        db.add(membership)
        db.flush()
        for branch in branches:
            db.add(
                BranchMembership(
                    organization_membership_id=membership.id,
                    organization_id=organization.id,
                    shop_id=branch.id,
                    status=MembershipStatus.ACTIVE,
                )
            )
            ensure_legacy_subscription_for_shop(db=db, shop_id=branch.id)
        db.commit()
        return user.id, branches[1].id, unique


def _branch_user(db, user_id: int, branch_id: int):
    return TenantRequestUser(user=db.get(User, user_id), active_shop_id=branch_id)


def test_concurrent_selected_branch_invoices_cannot_oversell_stock():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    user_id, branch_id, unique = _setup_multibranch_owner(Session)
    with Session() as db:
        user = _branch_user(db, user_id, branch_id)
        product = create_product(
            ProductCreate(
                name="Final unit",
                sku=f"FINAL-{unique}",
                category="General",
                buying_price=Decimal("40.00"),
                mrp=Decimal("100.00"),
                selling_price=Decimal("100.00"),
                stock_quantity=1,
                unit="pcs",
                is_active=True,
            ),
            user,
            db,
        )
        product_id = product.id
        product_sku = product.sku

    barrier = threading.Barrier(2)

    def sell(index: int):
        with Session() as db:
            user = _branch_user(db, user_id, branch_id)
            payload = InvoiceCreate.model_validate(
                {
                    "client_request_id": f"concurrent-sale-{unique}-{index}",
                    "customer": {
                        "first_name": "Concurrent",
                        "last_name": f"Buyer {index}",
                        "phone": f"9000001{index:03d}",
                    },
                    "items": [
                        {
                            "product_id": product_id,
                            "product_code": product_sku,
                            "quantity": 1,
                            "discount_percentage": 0,
                        }
                    ],
                    "invoice_date": date(2026, 10, 8),
                    "payment_status": "pending",
                    "payment_mode": "cash",
                    "paid_amount": 0,
                    "total_tax_amount": 0,
                    "invoice_status": "saved",
                }
            )
            barrier.wait(timeout=10)
            try:
                return 201, create_invoice(payload, db, user).id
            except HTTPException as exc:
                db.rollback()
                return exc.status_code, None

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(sell, range(2)))

    with Session() as db:
        product = db.get(Product, product_id)
        invoice_count = db.query(Invoice).filter_by(shop_id=branch_id).count()
        reconciliation = reconcile_stock_balances(db, shop_id=branch_id)

    assert sorted(status for status, _ in results) == [201, 400]
    assert product.stock_quantity == 0
    assert invoice_count == 1
    assert reconciliation["mismatch_count"] == 0
    engine.dispose()


def test_concurrent_receipt_and_return_posting_preserves_branch_ledger():
    engine = create_engine(POSTGRES_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    user_id, branch_id, unique = _setup_multibranch_owner(Session)
    with Session() as db:
        user = _branch_user(db, user_id, branch_id)
        product = create_product(
            ProductCreate(
                name="Receipt item",
                sku=f"RECEIPT-{unique}",
                category="General",
                buying_price=Decimal("25.00"),
                mrp=Decimal("50.00"),
                selling_price=Decimal("45.00"),
                stock_quantity=0,
                unit="pcs",
                is_active=True,
            ),
            user,
            db,
        )
        vendor = Vendor(
            shop_id=branch_id,
            vendor_name=f"Receipt Vendor {unique}",
            company_name="Release Verification",
            is_active=True,
        )
        db.add(vendor)
        db.commit()
        po = create_purchase_order(
            db,
            payload=PurchaseOrderCreate(
                vendor_id=vendor.id,
                order_date=date(2026, 10, 8),
                status="ordered",
                items=[
                    PurchaseOrderItemCreate(
                        product_id=product.id,
                        ordered_quantity=2,
                        unit_cost=Decimal("25.00"),
                    )
                ],
            ),
            current_user=user,
        )
        po_id = po.id
        po_item_id = po.items[0].id
        product_id = product.id

    receipt_barrier = threading.Barrier(2)

    def receive(index: int):
        with Session() as db:
            user = _branch_user(db, user_id, branch_id)
            receipt_barrier.wait(timeout=10)
            try:
                receipt = create_goods_receipt(
                    db,
                    po_id=po_id,
                    payload=GoodsReceiptCreate(
                        client_request_id=f"concurrent-receipt-{unique}-{index}",
                        received_date=date(2026, 10, 8),
                        items=[
                            GoodsReceiptItemCreate(
                                purchase_order_item_id=po_item_id,
                                received_quantity=2,
                                unit_cost=Decimal("25.00"),
                            )
                        ],
                    ),
                    current_user=user,
                )
                return 201, receipt.items[0].id
            except HTTPException as exc:
                db.rollback()
                return exc.status_code, None

    with ThreadPoolExecutor(max_workers=2) as executor:
        receipt_results = list(executor.map(receive, range(2)))
    assert sorted(status for status, _ in receipt_results) == [201, 409]
    receipt_item_id = next(item_id for status, item_id in receipt_results if status == 201)

    return_barrier = threading.Barrier(2)

    def return_goods(index: int):
        with Session() as db:
            user = _branch_user(db, user_id, branch_id)
            return_barrier.wait(timeout=10)
            try:
                purchase_return = create_purchase_return(
                    db,
                    po_id=po_id,
                    payload=PurchaseReturnCreate(
                        client_request_id=f"concurrent-return-{unique}-{index}",
                        return_date=date(2026, 10, 8),
                        reason="damaged",
                        items=[
                            PurchaseReturnItemCreate(
                                goods_receipt_item_id=receipt_item_id,
                                returned_quantity=2,
                            )
                        ],
                    ),
                    current_user=user,
                )
                return 201, purchase_return.id
            except HTTPException as exc:
                db.rollback()
                return exc.status_code, None

    with ThreadPoolExecutor(max_workers=2) as executor:
        return_results = list(executor.map(return_goods, range(2)))

    with Session() as db:
        product = db.get(Product, product_id)
        receipt_count = db.query(GoodsReceipt).filter_by(shop_id=branch_id).count()
        return_count = db.query(PurchaseReturn).filter_by(shop_id=branch_id).count()
        reconciliation = reconcile_stock_balances(db, shop_id=branch_id)

    assert sorted(status for status, _ in return_results) == [201, 409]
    assert product.stock_quantity == 0
    assert receipt_count == 1
    assert return_count == 1
    assert reconciliation["mismatch_count"] == 0
    engine.dispose()
