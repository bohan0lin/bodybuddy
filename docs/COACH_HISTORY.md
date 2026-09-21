# Coach conversation and proposal recovery

Implemented 2026-09-21. Rollout is disabled by default until the target database
has `20260921000000_coach_history.sql`.

Local verification: 263 unit/component tests, application and API typechecks,
lint and a feature-enabled frontend/PWA build. Eleven embedded PostgreSQL tests
cover the migration and permission boundaries. Hosted staging acceptance and
CLI-generated database type equivalence are still pending.

## Behavior

- Coach restores the latest 40 messages and their proposal states from Supabase.
  It blocks new requests if history cannot be loaded instead of starting an empty
  conversation that could hide existing records.
- User messages are persisted before generation. Assistant replies and their
  proposals are registered atomically before confirmation controls are shown.
- A lost persistence response retries the same message ID and response content,
  without another model call. Competing replies to one user message have one
  canonical database result.
- Pending proposals can be edited, explicitly saved as drafts, confirmed or
  cancelled. Unsaved edits are labeled and are not promised to survive reload.
- Confirmation can commit the reviewed edits directly. The business record,
  immutable action receipt and confirmed state share one transaction.
- Reloading restores confirmed/cancelled states. A stale version, cancellation
  or 30-day expiry prevents further confirmation. Exact confirmation/cancellation
  retries are idempotent. Draft retries with identical content do not bump versions.
- Only compressed 320-pixel JPEG thumbnails are kept in history. The original
  compressed photo is used for the current model request and is not archived.
- Interrupted generation is not resumed automatically. Text requests can be
  explicitly retried; photo requests require selecting the original photo again.
- Messages stay server-side until account deletion. The 40-message display limit
  is not a retention period. There is no browser history cache; account changes
  remount the authenticated app and unmount its conversation state.

## Database boundaries

`coach_messages` and `coach_proposals` permit owner-only reads through RLS.
Authenticated clients cannot mutate them directly. RPCs verify `p_owner` against
`auth.uid()`, preventing an old asynchronous response from being saved under a
newly signed-in account.

Proposal transitions serialize on a transaction advisory lock and row lock.
Version checks prevent one device from overwriting a newer edit or cancellation.
The original write implementation is renamed to `execute_agent_action` and its
client execution privileges are revoked. The legacy `confirm_agent_action`
wrapper still accepts unregistered old-client proposals but rejects all
registered proposal IDs, so cancellation cannot be bypassed by an older client.

Deleting an auth account cascades through messages, proposals and existing
receipts. Ordinary clients cannot delete proposal tombstones independently.

## Verification and rollout

1. Run `npm run test:history-db`. This executes the actual receipt/history SQL
   against embedded PostgreSQL with minimal auth/business-table fixtures. It
   checks recovery reads, idempotency, stale versions, expiry, cancellation,
   legacy bypass rejection, RLS, rollback and migration replay without Docker.
2. Once Docker is available, run the full Supabase migration/reset/upgrade suite,
   regenerate `src/lib/database.types.ts` with `npm run db:types`, and check it.
   The manually added types matched CLI-generated types from CI run 35642413733
   on 2026-09-21 after normalizing the trailing newline. That run also applied all
   migrations on a fresh Supabase stack; the full reset/upgrade suite remains separate.
3. Apply the migration to staging using the existing database release workflow.
4. Set `VITE_COACH_HISTORY_ENABLED=true` for the staging branch's Preview
   environment, then redeploy. Leave Production disabled until acceptance passes.
5. Test text/photo history after route changes and reload, edited draft recovery,
   confirm/cancel recovery, double confirmation, interrupted network requests,
   conflicting edits from two tabs, and sign-out/sign-in with another account.
6. Run the database tests with real concurrent connections. The embedded test
   connection verifies transition order but does not emulate simultaneous sessions.
   Completed in CI run 35642413733: 100 actions, 1,000 successful submissions,
   ten concurrent connections, zero duplicates, and four passing fault checks.
7. Apply the migration to production before enabling its flag, after approval.

Turning the UI flag off preserves stored history. Do not roll back the migration
by exposing the internal write function or removing proposal state: that could
allow old clients to confirm cancelled proposals.

## Limits

No offline outgoing queue, automatic durable AI jobs, original-photo archive,
history pagination or standalone history deletion UI is included. Older messages
remain in the account but only the latest 40 are loaded in this first version.
Previously unsaved conversations from old app versions cannot be recovered.

The three-model evaluation and keyboard-gap work remain paused.
