# Phase 3 — Core Circulation Testing

## Result

Core circulation reliability checks were completed for Library System v2. The API and frontend production builds pass, and the server test suite passes with eight tests.

## Changes made

- Idempotency keys are claimed before a mutating request executes. A concurrent duplicate now receives `IDEMPOTENCY_IN_PROGRESS` instead of performing the circulation action a second time; completed requests replay their stored response.
- Borrowing claims available copies before loans are created, preventing two simultaneous requests from issuing the same copy.
- Returns claim the active loan state before changing it, so the same loan cannot be returned twice concurrently.
- Preparing and receiving reservations use conditional state changes to prevent a copy or READY reservation being processed twice.
- Loan issue, return, fine payment, reservation preparation/receipt, lost/damaged incident, replacement, and copy restoration now write named audit events in addition to the general staff request audit.

## Coverage

- Authentication/authorization: JWT authentication, shared staff permission gate, Member denial of staff access, and login throttle contract.
- Borrowing/returns: available-copy and active-loan conditional state transitions.
- Reservations: member-only creation plus safe READY/RECEIVED transitions.
- Fines: automatic overdue-fine creation on return and staff payment flow.
- Lost/damaged/replacement: incident creation, replacement, and return-to-circulation auditing.
- Idempotency/concurrency: pre-execution request claim, replay state, and in-progress duplicate rejection.
- Audit safety: password/token redaction and staff action traceability.

## Verification

- `pnpm --dir server test` — 8 tests passed.
- `pnpm --dir server build` — passed.
- `pnpm build` — passed.

The suite is mock-based at the API boundary and does not create or alter trusted staging circulation records. A separate disposable-database integration suite would be the next step for real HTTP/database concurrency load testing.
