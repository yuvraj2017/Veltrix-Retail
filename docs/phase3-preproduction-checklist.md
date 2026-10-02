# Phase 3 Pre-Production Database Checklist

The application code is at Alembic revision `20261003_0017`. Upgrade the important
database only during an approved maintenance window after completing this checklist.

## Backup and rehearsal

1. Stop writes and capture a verified PostgreSQL backup with `pg_dump`.
2. Restore that backup into a disposable PostgreSQL database.
3. Confirm the disposable copy starts at `20261002_0014`.
4. Run the preflight query below and resolve any duplicate bill numbers deliberately.
5. Run `alembic upgrade head` only against the disposable copy.
6. Run application smoke tests and stock reconciliation on the disposable copy.

## Vendor bill preflight for revision 0017

```sql
SELECT
    shop_id,
    bill_number,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(id ORDER BY id) AS vendor_bill_ids
FROM vendor_bills
GROUP BY shop_id, bill_number
HAVING COUNT(*) > 1
ORDER BY shop_id, bill_number;
```

The query must return zero rows before applying revision `20261003_0017`. Do not
delete or renumber records without reviewing their vendor, payment history, and
supporting documents. Revision 0017 intentionally stops when duplicates exist.

## Controlled upgrade

1. Verify `alembic current` reports `20261002_0014`.
2. Apply `0015`, then verify stock-adjustment request tables and movement constraints.
3. Apply `0016`, then verify PO, PO item, sequence, receipt, and receipt-item tables.
4. Apply `0017`, then verify purchase-return, vendor-credit, vendor-payment idempotency,
   vendor-bill uniqueness, and restrictive history foreign keys.
5. Confirm `alembic current` and `alembic heads` both report `20261003_0017`.
6. Run ledger reconciliation for every shop; investigate every non-zero difference.
7. Verify PO/receipt/return counts and sample their stock movements.
8. Smoke test login, inventory overview, sale, receipt, purchase return, vendor bill,
   vendor payment, reporting, and CSV export.

## Recovery

Do not depend on destructive downgrades after new inventory history is written. If
verification fails, stop application writes, preserve logs and the failed database,
and restore the verified pre-upgrade backup. Diagnose and rehearse the correction on
a disposable copy before retrying the important database.
