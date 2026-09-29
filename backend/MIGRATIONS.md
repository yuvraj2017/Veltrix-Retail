# Database migrations

Alembic is the schema-management mechanism for this backend. Application
startup does not create tables, alter columns, or create indexes.

## Fresh database

1. Create an empty database.
2. Set `DATABASE_URL` and `SECRET_KEY` for the target environment.
3. From `backend/`, run:

   ```bash
   alembic -c alembic.ini upgrade head
   ```

4. Start the application.

## Existing populated database

Do not stamp an unknown database blindly.

1. Take a verified database backup first.
2. Confirm the existing schema contains the original POS/inventory tables and
   the startup-managed columns/indexes expected by the current application.
3. If the database has no `alembic_version` table but already contains the
   schema represented by a revision, stamp only to the verified revision.
4. Run `alembic -c alembic.ini upgrade head`.

If the schema does not match any known revision, create a disposable copy and
test the upgrade there before touching production.

## Duplicate invoice-number pre-check

Before applying the invoice-number integrity migration to an existing database,
check whether duplicate invoice numbers already exist inside any shop:

```sql
SELECT shop_id, invoice_number, COUNT(*) AS duplicate_count
FROM invoices
GROUP BY shop_id, invoice_number
HAVING COUNT(*) > 1
ORDER BY shop_id, invoice_number;
```

The migration refuses to add the unique invoice-number index until duplicates
are manually remediated. It never deletes, renames, or merges historical
invoices.
