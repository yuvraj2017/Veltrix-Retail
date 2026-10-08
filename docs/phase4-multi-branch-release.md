# Phase 4 Multi-Branch Release Guide

## Architecture

The tenant and operational boundary is:

```text
JWT identity
  -> User
  -> OrganizationMembership (tenant role and permissions)
  -> requested Shop/branch
  -> BranchMembership (branch access)
  -> Shop lifecycle
  -> Shop-scoped commercial entitlement
  -> branch-scoped business service
```

`X-Branch-ID` selects the request branch and is validated on every tenant
request. `User.shop_id` remains the persisted compatibility/preferred branch
when the header is omitted. It is never silently rewritten by branch switching.
The JWT contains identity only; roles, permissions, membership, lifecycle, and
entitlement are resolved from the database.

The frontend `BranchContext` loads only accessible active branches, stores the
selection per tab in `sessionStorage`, and injects `X-Branch-ID` centrally.
Branch-scoped TanStack Query keys prevent cache reuse across branches. Staff
administration remains organization-scoped.

## Lifecycle And Provisioning

Branches use `PENDING`, `ACTIVE`, and `INACTIVE`.

1. An OWNER with `branches.manage` creates a branch. It starts `PENDING`, is
   non-default, has no copied business data, subscription, or license, and all
   active OWNER memberships receive explicit branch access.
2. A platform SUPER_ADMIN assigns a branch-local plan through Admin Plans or
   `POST /api/v1/admin/shops/{shop_id}/subscription`. This creates the branch's
   own subscription/license; it never copies another branch's entitlement.
3. The OWNER activates the branch with
   `POST /api/v1/branches/{branch_id}/activate`. Activation fails unless the
   branch-local subscription and license permit access.
4. Non-owner staff receive access explicitly through the staff branch grant
   API. Revocation takes effect on the next request without a new JWT.

This is currently a platform-assisted provisioning workflow. A `PENDING`
branch cannot be selected as tenant context and therefore cannot use tenant
self-service checkout. Branch management also has no tenant-facing UI yet;
creation, lifecycle, and default changes are API operations. These are known
product limitations, not authorization bypasses.

Exactly one default branch is preserved per organization. Default changes and
lifecycle mutations lock the organization/branch rows. Deactivation refuses
the default, final active branch, a branch referenced by an active
`User.shop_id`, or a change that would strand an active OWNER.

## Roles And Isolation

- OWNER: organization operations, branch management, staff management,
  commercial management, and ownership transfer, subject to entitlement.
- ADMIN: broad operations and lower-role staff management; no branch creation,
  ownership transfer, OWNER/ADMIN promotion, or commercial ownership.
- MANAGER: operational sales, inventory, purchasing, expenses, reports, and
  audit; no staff, branch, subscription, or ownership management.
- CASHIER: constrained POS/customer/payment/return work; no refund,
  finalized cancellation, inventory adjustment, purchasing, staff, settings,
  or subscription management.
- INVENTORY_MANAGER: product/inventory/count/adjust/export operations.
- PURCHASING_MANAGER: vendor/PO/receipt/return/payable operations without vendor
  payment execution.
- REPORT_VIEWER: read-only operational reporting.
- SUPER_ADMIN: platform APIs only; it receives no tenant permissions or branch
  context.

Organization membership never implies branch access. OWNER access is explicit
through BranchMembership, including automatic owner assignment on branch
creation. Products, inventory, customers, vendors, invoices, expenses,
purchasing, reports, settings, subscriptions, and audit attribution remain
Shop-scoped. There is no shared catalog, BranchInventory, stock transfer, or
consolidated organization reporting in Phase 4.

## Transaction Safety

POS drafts are keyed by user, organization, and branch, include a schema
version and optimistic revision, and exclude tender credentials. Legacy global
drafts migrate only when user/organization/branch ownership is explicit;
otherwise they are quarantined for discard.

Dirty branch-sensitive forms register with the global branch-switch guard.
Critical financial and stock mutations disable switching while pending.
Requests snapshot `X-Branch-ID` at dispatch, idempotency keys remain
branch-scoped, stale callbacks are generation-checked, and only the originating
branch cache is invalidated. Each browser tab keeps an independent active
branch; optimistic draft revisions reject silent cross-tab overwrites.

## Deployment Prerequisites

1. PostgreSQL must be managed by an identified service account and configured
   to start before the API service.
2. Set `DATABASE_URL`, a strong unique `SECRET_KEY`, explicit `CORS_ORIGINS`,
   `FRONTEND_BASE_URL`, and `VITE_API_BASE_URL`; do not commit environment files.
3. Build the frontend for the production API origin and serve it behind TLS.
4. Route `/api` and `/health` consistently at the reverse proxy; preserve
   `X-Branch-ID` and standard authorization headers.
5. Stop application writes, take and verify a `pg_dump -Fc` backup, rehearse
   migration on a disposable restore, then run Alembic normally. Never stamp an
   unknown schema.
6. Verify `/health`, login, branch discovery, representative read paths,
   reconciliation, financial checks, and application logs after deployment.
7. Retain the immediate pre-upgrade backup until acceptance and rehearse the
   restore procedure before a production maintenance window.

## Release Checklist

- Alembic current/head are the single expected revision.
- Every organization has exactly one default branch and one usable OWNER.
- Membership organization/shop consistency checks return zero errors.
- Existing shops are `ACTIVE`; no user preference changed unexpectedly.
- Cross-organization and cross-branch IDOR tests pass.
- Platform-assisted branch provisioning and activation pass end to end.
- Branch lifecycle and owner/default PostgreSQL races pass.
- Invoice, stock, receipt, return, and payment regressions pass.
- Frontend branch cache, drafts, dirty guards, mutation locks, and revocation
  recovery pass.
- Responsive Playwright checks pass at 375, 768, 1024, and 1440 pixels.
- Backend, frontend, TypeScript, production build, and Playwright suites pass.
- Important database reconciliation has zero stock and financial anomalies.

## Phase 4D.6 Verification Evidence

Verification completed on 2026-10-08:

- Backend: 430 passed, 7 environment-gated PostgreSQL tests skipped in the
  normal suite.
- Disposable PostgreSQL: 7/7 concurrency and branch-isolation tests passed,
  including default changes, branch creation, lifecycle, ownership transfer,
  branch-creation/ownership-transfer ordering, invoice stock contention, and
  receipt/return contention.
- Frontend TypeScript and production build: passed.
- Playwright: 39/39 passed across authentication, branch context, responsive
  inventory/staff UI, POS billing, and transactional branch switching.
- Important database remained read-only at `ims_db/public`, revision
  `20261007_0020`; all 9 existing shops were `ACTIVE`, default/membership/owner
  consistency violations were zero, stock mismatches were zero, and all
  financial anomaly categories were zero.

One release verification defect was corrected: ownership transfer now
synchronizes the incoming OWNER's explicit BranchMemberships while sharing the
organization lock used by branch creation. This prevents either serialized
race order from leaving the final OWNER without access to a newly created
branch.

## Known Limits

- Tenant self-service provisioning of a `PENDING` branch is not available;
  platform administration must provision it before activation.
- Tenant branch-management UI is not included; the backend management APIs are
  the supported control surface.
- Manual screen-reader verification and the broader production load/failover
  exercise remain pre-production tasks.
- Products, customers, vendors, subscriptions, and inventory are branch-local.
  Organization-wide sharing and consolidated reporting are intentionally
  deferred.
