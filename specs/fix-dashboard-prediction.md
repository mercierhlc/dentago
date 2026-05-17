# Fix dashboard: dynamic reorder predictions + remove hardcoded demo data

## Context
The clinic dashboard at app/dashboard/page.tsx has a "Low Stock" sidebar widget that uses hardcoded fake data (const LOW_STOCK = [...]) with made-up product names and stock numbers. This makes it look like a demo, not a real product. Also the task: add a smart reorder prediction widget based on real order history.

## Tasks

### 1. Remove hardcoded LOW_STOCK constant
Delete the `const LOW_STOCK` array (lines ~98-102) and all JSX that renders it.

### 2. Replace with a "Reorder Soon" widget based on real order history
Add a new `ReorderSoon` section that:
- Fetches the clinic's order history from GET /api/orders (already exists)
- Groups items by product_id, counting how many times each product was ordered and the last order date
- Products ordered 2+ times: estimate reorder cadence = avg days between orders
- Show products where `daysSinceLastOrder >= 0.8 * avgCadence` as "due soon"
- Products ordered only once and >30 days ago: show as "consider restocking"
- Show max 3 items. If none qualify, hide the widget entirely (don't show empty state)
- Each item shows: product name, supplier name, "Last ordered X days ago", a quick "Reorder" link to /search?q=PRODUCT_NAME

### 3. Widget design
Follow existing card style (bg-white rounded-3xl border border-slate-100). Use amber for "due soon" and slate for "consider restocking". Match the existing STATUS_META / MetricCard aesthetic.

## Implementation notes
- All data comes from the existing GET /api/orders endpoint — no new API routes needed
- The orders already include dentago_order_items with dentago_products.name
- Keep the Quick Actions card and the Tip card — only remove LOW_STOCK
- TypeScript must compile clean: npx tsc --noEmit

## Acceptance criteria
- No hardcoded stock data anywhere in the file
- Widget shows real reorder suggestions when a clinic has 2+ orders
- Widget hidden when no data qualifies
- TypeScript compiles clean
