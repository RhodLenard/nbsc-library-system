# Phase 6 — Remove demo behavior

## Objective

Phase 6 removes prototype-only behavior from the production application. A visible action must either complete against the API and database or be omitted from the interface until its backend workflow exists.

## Corrections made

- Removed `src/lib/seed.ts` from the frontend source tree. Production state now starts empty and is populated only by the authenticated `/app/bootstrap` response.
- Removed demo/sample wording from user-facing screens, including export previews, receipts, catalog confirmations, and generated barcode comments.
- Removed the hard-coded OTP value `123456`; authentication accepts only credentials validated by the API.
- Removed unreachable demo backup restore messaging and hid backup download/delete controls that had no implemented server endpoint.
- Hid local-only delete, unlink, and entity-management controls where no production API operation exists.
- Kept catalog import/export, member export, report export, backup creation, and restore testing because each is connected to a server route.

## Production behavior rules

| Area                | Production behavior                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Initial data        | Loaded from the authenticated API; no browser seed dataset is used.                                                   |
| Authentication      | Passwords and sessions are handled by the API; no fixed OTP or fallback login is accepted.                            |
| Circulation         | Borrow, return, fine payment, reservation, and incident actions refresh from the API after success.                   |
| Messaging           | Messages and read receipts are persisted through API routes.                                                          |
| Catalog and members | Create/update/import operations use server endpoints. Unsupported destructive operations are not shown.               |
| Reports             | Charts use loaded library records; downloads call the authenticated report export endpoint.                           |
| Backups             | Creation and clean-database restore tests call the backup API. Unsupported file download/deletion actions are hidden. |

## Bug fixed during cleanup

Several actions called a real API mutation and then continued into an old browser-only fallback. If the API rejected the request, the UI could still show the incident, replacement, restored copy, sent message, or member status change as successful. Those fallback mutations were removed. API failures now leave application state unchanged and show the returned error.

## Verification

The following checks pass from the repository root:

```bash
pnpm build
pnpm --dir server build
```

The source tree was also checked for the removed strings and behaviors:

- `123456`
- `Demo Data`
- `simulated`
- `sample preview`
- `Demo only`
- `demo catalog`

No matches remain in `src/` or `server/src/`.

## Follow-up guidance

When a new UI control is added, add its API route and persistence path first. If that route is not available, keep the feature out of navigation and page actions rather than implementing a browser-only approximation.
