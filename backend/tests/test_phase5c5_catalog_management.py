from decimal import Decimal

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.core.membership import MembershipRole
from app.models.admin_audit_log import AdminAuditLog
from app.models.entitlement import (
    EntitlementDefinition,
    EntitlementKind,
    EntitlementValueType,
    PlanEntitlement,
)
from app.models.plan_catalog import PlanCatalogEntitlementSnapshot, PlanCatalogVersion
from app.models.plan import Plan
from app.schemas.subscription import (
    CatalogEntitlementSnapshotRequest,
    PlanCatalogPublishRequest,
    PlanCreateRequest,
)
from app.services import commercial_service


def _definitions(db, *, include_inactive=False):
    rows = [
        EntitlementDefinition(
            key="staff.max",
            name="Staff seats",
            kind=EntitlementKind.LIMIT,
            value_type=EntitlementValueType.INTEGER,
            resource_key="staff",
            is_active=True,
        ),
        EntitlementDefinition(
            key="storage.max",
            name="Storage allowance",
            kind=EntitlementKind.LIMIT,
            value_type=EntitlementValueType.DECIMAL,
            resource_key="storage",
            is_active=True,
        ),
        EntitlementDefinition(
            key="reports.advanced",
            name="Advanced reports",
            kind=EntitlementKind.FEATURE,
            value_type=EntitlementValueType.BOOLEAN,
            resource_key="reports",
            is_active=True,
        ),
    ]
    if include_inactive:
        rows.append(
            EntitlementDefinition(
                key="retired.feature",
                name="Retired feature",
                kind=EntitlementKind.FEATURE,
                value_type=EntitlementValueType.BOOLEAN,
                resource_key="retired",
                is_active=False,
            )
        )
    db.add_all(rows)
    db.commit()
    return rows


def _complete_snapshot(definitions, *, staff=0, storage="10.5", advanced=False):
    values = []
    for definition in definitions:
        if not definition.is_active:
            continue
        if definition.key == "staff.max":
            values.append(
                CatalogEntitlementSnapshotRequest(
                    entitlement_id=definition.id,
                    limit_value=Decimal(staff),
                    is_unlimited=False,
                )
            )
        elif definition.key == "storage.max":
            values.append(
                CatalogEntitlementSnapshotRequest(
                    entitlement_id=definition.id,
                    limit_value=Decimal(storage),
                    is_unlimited=False,
                )
            )
        else:
            values.append(
                CatalogEntitlementSnapshotRequest(
                    entitlement_id=definition.id,
                    feature_enabled=advanced,
                )
            )
    return values


def _plan(db, actor, definitions, code="catalog-ui"):
    return commercial_service.create_plan(
        db,
        PlanCreateRequest(
            code=code,
            name="Catalog UI Plan",
            monthly_price=Decimal("499.00"),
            annual_price=Decimal("4990.00"),
            currency="INR",
            trial_days=7,
            grace_period_days=3,
            entitlements=_complete_snapshot(definitions),
        ),
        actor,
    )


def _publish_request(definitions, **overrides):
    values = {
        "expected_latest_version_number": 1,
        "monthly_price": Decimal("599.00"),
        "annual_price": Decimal("5990.00"),
        "currency": "INR",
        "trial_days": 10,
        "grace_period_days": 4,
        "entitlements": _complete_snapshot(definitions),
    }
    values.update(overrides)
    return PlanCatalogPublishRequest(**values)


def _commercial_state(db, plan_id):
    plan = commercial_service._require_plan(db, plan_id)
    return {
        "versions": db.query(PlanCatalogVersion).filter_by(plan_id=plan_id).count(),
        "snapshots": (
            db.query(PlanCatalogEntitlementSnapshot)
            .join(PlanCatalogVersion)
            .filter(PlanCatalogVersion.plan_id == plan_id)
            .count()
        ),
        "projection": [
            (row.entitlement_id, row.limit_value, row.is_unlimited, row.feature_enabled)
            for row in db.query(PlanEntitlement)
            .filter_by(plan_id=plan_id)
            .order_by(PlanEntitlement.entitlement_id)
            .all()
        ],
        "plan": (
            plan.monthly_price,
            plan.annual_price,
            plan.currency,
            plan.trial_days,
            plan.grace_period_days,
        ),
        "audits": (
            db.query(AdminAuditLog)
            .filter_by(target_entity_type="plan_catalog_version")
            .count()
        ),
    }


def _assert_rejected_atomically(db, plan, actor, payload, *, status_code=400):
    before = _commercial_state(db, plan.id)
    with pytest.raises(HTTPException) as exc:
        commercial_service.publish_plan_catalog_version(db, plan.id, payload, actor)
    assert exc.value.status_code == status_code
    assert _commercial_state(db, plan.id) == before
    return exc.value


def test_complete_snapshot_is_published_and_zero_remains_finite(db_session, super_admin):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions)

    published = commercial_service.publish_plan_catalog_version(
        db_session, plan.id, _publish_request(definitions), super_admin
    )

    snapshots = {row.entitlement_key: row for row in published.entitlement_snapshots}
    assert set(snapshots) == {row.key for row in definitions}
    assert snapshots["staff.max"].limit_value == Decimal("0")
    assert snapshots["staff.max"].is_unlimited is False


@pytest.mark.parametrize("omitted_count", [1, 2, 3])
def test_missing_or_empty_snapshot_is_rejected_atomically(
    db_session, super_admin, omitted_count
):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions)
    submitted = _complete_snapshot(definitions)[:-omitted_count]

    exc = _assert_rejected_atomically(
        db_session,
        plan,
        super_admin,
        _publish_request(definitions, entitlements=submitted),
    )

    assert exc.detail["code"] == "CATALOG_SNAPSHOT_INVALID"
    assert len(exc.detail["details"]["missing_entitlements"]) == omitted_count


def test_omitted_snapshot_field_is_rejected_when_definitions_are_active(
    db_session, super_admin
):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions)
    payload = PlanCatalogPublishRequest(
        expected_latest_version_number=1,
        monthly_price=Decimal("599"),
        annual_price=Decimal("5990"),
        currency="INR",
    )

    _assert_rejected_atomically(db_session, plan, super_admin, payload)


def test_plan_creation_cannot_publish_an_incomplete_baseline(db_session, super_admin):
    definitions = _definitions(db_session)
    before_plans = db_session.query(Plan).count()
    before_audits = db_session.query(AdminAuditLog).count()

    with pytest.raises(HTTPException) as exc:
        commercial_service.create_plan(
            db_session,
            PlanCreateRequest(
                code="incomplete-baseline",
                name="Incomplete baseline",
                monthly_price=Decimal("100"),
                annual_price=Decimal("1000"),
                currency="INR",
            ),
            super_admin,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "CATALOG_SNAPSHOT_INVALID"
    assert len(exc.value.detail["details"]["missing_entitlements"]) == len(definitions)
    assert db_session.query(Plan).count() == before_plans
    assert db_session.query(AdminAuditLog).count() == before_audits


def test_duplicate_unknown_and_inactive_definitions_are_rejected_atomically(
    db_session, super_admin
):
    definitions = _definitions(db_session, include_inactive=True)
    active = [row for row in definitions if row.is_active]
    inactive = next(row for row in definitions if not row.is_active)
    plan = _plan(db_session, super_admin, definitions)
    complete = _complete_snapshot(active)

    duplicate = _assert_rejected_atomically(
        db_session,
        plan,
        super_admin,
        _publish_request(active, entitlements=[*complete, complete[0]]),
    )
    assert duplicate.detail["details"]["duplicate_entitlement_ids"] == [complete[0].entitlement_id]

    unknown = _assert_rejected_atomically(
        db_session,
        plan,
        super_admin,
        _publish_request(
            active,
            entitlements=[
                *complete,
                CatalogEntitlementSnapshotRequest(
                    entitlement_id=999999,
                    feature_enabled=False,
                ),
            ],
        ),
    )
    assert unknown.detail["details"]["unknown_entitlement_ids"] == [999999]

    inactive_result = _assert_rejected_atomically(
        db_session,
        plan,
        super_admin,
        _publish_request(
            active,
            entitlements=[
                *complete,
                CatalogEntitlementSnapshotRequest(
                    entitlement_id=inactive.id,
                    feature_enabled=False,
                ),
            ],
        ),
    )
    assert inactive_result.detail["details"]["inactive_entitlements"] == [
        {"id": inactive.id, "key": inactive.key}
    ]


def test_invalid_boolean_and_integer_values_are_rejected_atomically(
    db_session, super_admin
):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions)
    staff = next(row for row in definitions if row.key == "staff.max")
    feature = next(row for row in definitions if row.kind == EntitlementKind.FEATURE)

    invalid_integer = _complete_snapshot(definitions)
    invalid_integer[0] = CatalogEntitlementSnapshotRequest(
        entitlement_id=staff.id,
        limit_value=Decimal("1.5"),
    )
    _assert_rejected_atomically(
        db_session,
        plan,
        super_admin,
        _publish_request(definitions, entitlements=invalid_integer),
    )

    invalid_feature = _complete_snapshot(definitions)
    invalid_feature[-1] = CatalogEntitlementSnapshotRequest(
        entitlement_id=feature.id,
        feature_enabled=None,
    )
    _assert_rejected_atomically(
        db_session,
        plan,
        super_admin,
        _publish_request(definitions, entitlements=invalid_feature),
    )

    with pytest.raises(ValidationError):
        CatalogEntitlementSnapshotRequest.model_validate(
            {"entitlement_id": feature.id, "feature_enabled": "not-a-boolean"}
        )


def test_valid_unlimited_snapshot_is_accepted(db_session, super_admin):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions)
    payloads = _complete_snapshot(definitions)
    payloads[0] = CatalogEntitlementSnapshotRequest(
        entitlement_id=payloads[0].entitlement_id,
        limit_value=None,
        is_unlimited=True,
    )

    published = commercial_service.publish_plan_catalog_version(
        db_session,
        plan.id,
        _publish_request(definitions, entitlements=payloads),
        super_admin,
    )

    assert published.entitlement_snapshots[0].is_unlimited is True


def test_super_admin_lists_read_only_catalog_history_newest_first(
    client, db_session, super_admin, admin_headers
):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions)
    commercial_service.publish_plan_catalog_version(
        db_session, plan.id, _publish_request(definitions), super_admin
    )

    response = client.get(
        f"/api/v1/admin/plans/{plan.id}/catalog-versions",
        headers=admin_headers,
    )

    assert response.status_code == 200
    history = response.json()
    assert [item["version_number"] for item in history] == [2, 1]
    assert history[0]["monthly_price"] == "599.00"
    assert len(history[0]["entitlement_snapshots"]) == len(definitions)


@pytest.mark.parametrize(
    "membership_role",
    [
        MembershipRole.OWNER,
        MembershipRole.ADMIN,
        MembershipRole.CASHIER,
        MembershipRole.REPORT_VIEWER,
    ],
)
def test_catalog_routes_reject_each_tenant_role(
    client,
    db_session,
    super_admin,
    make_user,
    auth_headers,
    membership_role,
):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions, code=f"catalog-{membership_role}")
    user = make_user(
        email=f"catalog-{membership_role}@example.com",
        membership_role=membership_role,
    )
    headers = auth_headers(user.email)
    body = _publish_request(definitions).model_dump(mode="json")

    history = client.get(
        f"/api/v1/admin/plans/{plan.id}/catalog-versions", headers=headers
    )
    publication = client.post(
        f"/api/v1/admin/plans/{plan.id}/catalog-versions",
        headers=headers,
        json=body,
    )

    assert history.status_code == 403
    assert publication.status_code == 403
    assert db_session.query(PlanCatalogVersion).filter_by(plan_id=plan.id).count() == 1


def test_catalog_routes_reject_unauthenticated_and_allow_super_admin(
    client, db_session, super_admin, admin_headers
):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions, code="catalog-platform-auth")
    path = f"/api/v1/admin/plans/{plan.id}/catalog-versions"
    body = _publish_request(definitions).model_dump(mode="json")

    unauthenticated_history = client.get(path)
    unauthenticated_publication = client.post(path, json=body)
    authorized = client.get(path, headers=admin_headers)

    assert unauthenticated_history.status_code in {401, 403}
    assert unauthenticated_publication.status_code in {401, 403}
    assert authorized.status_code == 200
    assert db_session.query(PlanCatalogVersion).filter_by(plan_id=plan.id).count() == 1


def test_stale_catalog_publication_is_rejected_without_partial_version(
    db_session, super_admin
):
    definitions = _definitions(db_session)
    plan = _plan(db_session, super_admin, definitions, code="catalog-stale")
    commercial_service.publish_plan_catalog_version(
        db_session,
        plan.id,
        _publish_request(definitions, monthly_price=Decimal("550.00")),
        super_admin,
    )

    stale = _publish_request(
        definitions,
        expected_latest_version_number=1,
        monthly_price=Decimal("1.00"),
    )
    exc = _assert_rejected_atomically(
        db_session,
        plan,
        super_admin,
        stale,
        status_code=409,
    )

    assert exc.detail["code"] == "CATALOG_VERSION_CONFLICT"
    db_session.refresh(plan)
    assert plan.monthly_price == Decimal("550.00")
