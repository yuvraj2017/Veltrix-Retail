# Phase 3 PostgreSQL Concurrency Checklist

Run this checklist only against a disposable PostgreSQL database migrated to
`20261003_0017`. Use two authenticated clients for the same shop and release both
requests at the same barrier. Give every intentional operation a recorded request key.

After each case, verify the product and ledger agree:

```sql
SELECT
    p.id,
    p.sku,
    p.stock_quantity,
    COALESCE(SUM(sm.quantity_delta), 0) AS ledger_quantity
FROM products p
LEFT JOIN stock_movements sm ON sm.product_id = p.id AND sm.shop_id = p.shop_id
WHERE p.shop_id = :shop_id
GROUP BY p.id, p.sku, p.stock_quantity
HAVING p.stock_quantity <> COALESCE(SUM(sm.quantity_delta), 0);
```

The reconciliation query must return zero rows.

| Case | Initial state | Simultaneous actions | Expected result and invariant |
|---|---|---|---|
| Final-stock sales | Stock 1 | Two finalized invoices for quantity 1, different invoice keys | One succeeds; one gets insufficient stock; one sale movement; stock 0. |
| Draft reservations | Stock 1 | Two drafts reserve quantity 1 | One succeeds; one fails; one reserve movement; stock 0. |
| Invoice replay | Stock 5 | Same invoice key and payload twice | Both resolve to one invoice; one number, sale movement, customer update, analytics row, and creation audit. |
| Adjustments | Stock 5 | Adjustment IN 2 and OUT 3 with different keys | Operations serialize; final stock 4; two movements in committed order. |
| Physical counts | Stock 5 | Physical counts 4 and 7 with different keys | Operations serialize against the latest locked balance; final value matches the last committed count; ledger reconciles. |
| Receipt vs sale | Stock 1; open PO remaining 2 | Receipt 2 and sale 1 | Both commit in lock order; final stock 2; one receipt and one sale movement. |
| Receipt vs adjustment | Stock 1; open PO remaining 2 | Receipt 2 and adjustment OUT 1 | Both serialize; final stock 2; receipt and adjustment each recorded once. |
| Final PO receipt | Ordered 10, received 8 | Two receipts of 2 with different keys | One succeeds; one over-receipt conflict; received remains 10; one new receipt movement. |
| Receipt replay | Ordered 10, received 8 | Same receipt key/payload twice for quantity 2 | One receipt, one item update, one stock movement, one audit; both responses identify the same receipt. |
| Purchase return vs sale | Sellable 2; returnable received quantity at least 2 | Purchase return 2 and sale 2 | Only the first stock consumer succeeds; stock never negative; failed operation leaves no children/audit. |
| Final returnable quantity | Received 10, already returned 8, sellable at least 4 | Two purchase returns of 2 with different keys | One succeeds; one over-return conflict; total returned 10; one new credit and movement. |
| Purchase-return replay | Returnable 2; sellable 2 | Same return key/payload twice | One return, item set, stock movement, VendorCredit, and audit. |
| Final vendor balance | Bill total 1,000; paid 800 | Two payments of 200 with different keys | One succeeds; the other sees zero remaining and conflicts; applied total is exactly 1,000. |
| Vendor-payment replay | Bill remaining 200 | Same payment key/payload twice | One payment and audit; bill paid/remaining totals count it once. |
| PO numbering | No PO for the selected shop/date | Create two POs simultaneously | Both succeed with distinct sequential PO numbers and the shop/date sequence advances twice. |

For each rejected request, confirm there is no partial parent row, child row, stock
movement, financial record, or business-audit entry. Reuse a successful key with a
changed payload and confirm HTTP 409 without additional effects.
