# Fix /orders page — failed to load

## Context
The orders page at app/orders/page.tsx is failing to load orders. The page exists and has the correct type definitions but something is breaking the fetch.

## Task
Debug and fix the /orders page so it loads clinic orders correctly.

### Steps
1. Read app/orders/page.tsx fully
2. Read app/api/orders/route.ts GET handler
3. Identify why orders fail to load — likely auth header issue, wrong endpoint params, or missing clinicId filter
4. The orders GET endpoint at /api/orders supports: ?limit=N&page=N — it uses freshAuthHeaders() from lib/auth
5. Check that freshAuthHeaders() is being called correctly (it's async)
6. Also check: does the GET handler filter by clinic? It should only return orders for the logged-in clinic, not all orders
7. Fix whatever is broken

## Acceptance criteria
- /orders page loads successfully for a logged-in clinic
- Shows the clinic's own orders only
- Empty state shown when no orders yet
- TypeScript compiles clean: npx tsc --noEmit
