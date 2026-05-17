# OS Approvals tab — database setup (one-time)

> **Reference only.** Running SQL fixes infrastructure visibility — unrelated Agent rows stay whatever status they already have unless you change them explicitly.

The `/os` Approvals queue reads **`os_approval_requests`**. If inserts failed with “Could not find the table”, run this in the Supabase **SQL editor** for project **wybqjycfpauwlcrqgtfb**:

1. Paste the full contents of **`supabase/migrations/20260505_os_approval_requests.sql`** from this repo.
2. Execute once.

Optional: re-run **`npm run os:week3-queue`** once if you want structured approval seed rows aligned with Week 3 (otherwise Approvals can be managed purely manually).

## Related `/os` items

- **Agents:** Older `[FOUNDER APPROVAL]` fallback rows — consolidate/lifecycle separately after this table exists.
