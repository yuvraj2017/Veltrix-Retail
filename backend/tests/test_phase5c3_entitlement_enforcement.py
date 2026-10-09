from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.api.v1.endpoints import products as product_endpoints
from app.core.domain_errors import DomainErrorCode
from app.core.membership import MembershipRole
from app.models.entitlement import EntitlementDefinition, ShopEntitlementOverride
from app.services.entitlement_service import ensure_feature_enabled
from app.services.image_service import delete_uploaded_image_variants


def _override(db, shop_id: int, key: str, *, enabled=None, limit=None):
    definition = (
        db.query(EntitlementDefinition)
        .filter(EntitlementDefinition.key == key)
        .one()
    )
    row = ShopEntitlementOverride(
        shop_id=shop_id,
        entitlement_id=definition.id,
        feature_enabled=enabled,
        limit_value=limit,
        starts_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        reason="Phase 5C.3 test override",
    )
    db.add(row)
    db.commit()
    return row


def _product_form(sku: str) -> dict[str, str]:
    return {
        "name": "Entitlement product",
        "sku": sku,
        "category": "Test",
        "buying_price": "10.00",
        "mrp": "15.00",
        "selling_price": "12.00",
        "gst_rate": "0",
        "stock_quantity": "0",
        "low_stock_threshold": "0",
        "unit": "pcs",
        "is_active": "true",
    }


def test_feature_helper_fails_closed_with_stable_error_and_override_precedence(
    db_session, make_user
):
    owner = make_user(email="phase5c3-feature@example.com")
    _override(
        db_session,
        owner.shop_id,
        "reports.advanced",
        enabled=False,
    )

    try:
        ensure_feature_enabled(owner.shop_id, "reports.advanced", db_session)
        raise AssertionError("disabled feature unexpectedly allowed")
    except HTTPException as exc:
        assert exc.status_code == 403
        assert exc.detail["code"] == DomainErrorCode.FEATURE_NOT_AVAILABLE
        assert exc.detail["details"]["feature_key"] == "reports.advanced"
        assert exc.detail["details"]["source"] == "override"

    _override(
        db_session,
        owner.shop_id,
        "reports.advanced",
        enabled=True,
    )
    effective = ensure_feature_enabled(
        owner.shop_id, "reports.advanced", db_session
    )
    assert effective.source == "override"
    assert effective.feature_enabled is True


def test_advanced_reports_and_exports_are_enforced_through_direct_api_calls(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="phase5c3-routes@example.com")
    headers = auth_headers(owner.email)
    _override(db_session, owner.shop_id, "reports.advanced", enabled=False)
    _override(db_session, owner.shop_id, "export.enabled", enabled=False)

    report = client.get("/api/v1/reports/summary", headers=headers)
    export = client.get("/api/v1/inventory/exports/inventory", headers=headers)

    assert report.status_code == 403
    assert report.json()["detail"]["code"] == DomainErrorCode.FEATURE_NOT_AVAILABLE
    assert export.status_code == 403
    assert export.json()["detail"]["code"] == DomainErrorCode.FEATURE_NOT_AVAILABLE


def test_feature_entitlement_does_not_replace_rbac(
    client, make_user, auth_headers
):
    cashier = make_user(
        email="phase5c3-cashier@example.com",
        membership_role=MembershipRole.CASHIER,
    )
    response = client.get(
        "/api/v1/reports/summary",
        headers=auth_headers(cashier.email),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "You do not have permission to perform this action"


def test_custom_branding_only_gates_an_actual_logo_change(
    client, db_session, make_user, auth_headers
):
    owner = make_user(email="phase5c3-branding@example.com")
    shop = owner.shop
    headers = auth_headers(owner.email)
    _override(db_session, owner.shop_id, "custom_branding.enabled", enabled=False)
    payload = {
        "name": shop.name,
        "category": shop.category,
        "email": shop.email,
        "phone": shop.phone,
        "whatsapp_number": shop.whatsapp_number,
        "address": shop.address,
        "logo_url": None,
        "gst_enabled": shop.gst_enabled,
        "gstin": shop.gstin,
        "state": shop.state,
        "gst_state_code": shop.gst_state_code,
    }

    unchanged = client.put(f"/api/v1/shops/{shop.id}", json=payload, headers=headers)
    assert unchanged.status_code == 200

    payload["logo_url"] = "/uploads/logos/restricted.webp"
    changed = client.put(f"/api/v1/shops/{shop.id}", json=payload, headers=headers)
    assert changed.status_code == 403
    assert changed.json()["detail"]["code"] == DomainErrorCode.FEATURE_NOT_AVAILABLE


def test_product_quota_is_checked_before_upload_persistence(
    client, db_session, make_user, auth_headers, monkeypatch
):
    owner = make_user(email="phase5c3-product-limit@example.com")
    _override(db_session, owner.shop_id, "products.max", limit=0)
    called = False

    def unexpected_save(_images):
        nonlocal called
        called = True
        return []

    monkeypatch.setattr(product_endpoints, "save_uploaded_product_images", unexpected_save)
    response = client.post(
        "/api/v1/products",
        data=_product_form("LIMITED-UPLOAD"),
        headers=auth_headers(owner.email),
    )

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == DomainErrorCode.PLAN_LIMIT_REACHED
    assert called is False


def test_failed_product_creation_removes_generated_image_variants(
    client, make_user, auth_headers, monkeypatch, tmp_path
):
    owner = make_user(email="phase5c3-product-cleanup@example.com")
    monkeypatch.chdir(tmp_path)
    upload_dir = tmp_path / "uploads" / "products"
    upload_dir.mkdir(parents=True)
    full = upload_dir / "failed.webp"
    thumbnail = upload_dir / "failed_thumb.webp"
    full.write_bytes(b"full")
    thumbnail.write_bytes(b"thumbnail")

    monkeypatch.setattr(
        product_endpoints,
        "save_uploaded_product_images",
        lambda _images: ["/uploads/products/failed.webp"],
    )

    def fail_create(*_args, **_kwargs):
        raise HTTPException(status_code=409, detail="simulated transaction failure")

    monkeypatch.setattr(product_endpoints, "create_product", fail_create)
    response = client.post(
        "/api/v1/products",
        data=_product_form("FAILED-UPLOAD"),
        headers=auth_headers(owner.email),
    )

    assert response.status_code == 409
    assert not full.exists()
    assert not thumbnail.exists()


def test_upload_cleanup_never_deletes_outside_upload_root(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    outside = tmp_path / "outside.webp"
    outside.write_bytes(b"keep")

    delete_uploaded_image_variants("/outside.webp")

    assert outside.exists()
