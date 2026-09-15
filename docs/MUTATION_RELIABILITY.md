# Meal and workout write reliability

Updated: 2026-09-15. Work is uncommitted on `codex/agent-proposals-evaluations`.

## Implemented in this batch

- Store meal/workout create, update and delete methods return promises. Visible
  records change only after database acknowledgement, so failed writes do not
  display optimistic success.
- Updates require a returned row; missing or inaccessible records are errors.
- Identical pending operations on one record share a promise; conflicting
  operations are rejected while that record is busy.
- Callers supply a stable create ID. A duplicate insert reads and compares the
  existing row. Different content raises a conflict instead of overwriting it.
- Older refresh responses cannot overwrite a confirmed mutation.
- Database requests in these paths have a 20-second abort deadline.
- Workout forms await saves/deletes, retain failures, prevent duplicate taps,
  and freeze the submitted content for uncertain-save retries. Invalid duration
  and burn values are rejected. Clearing a workout note now clears the database
  value as well.
- Day-page meal/workout deletion requires confirmation, shows pending/error
  states, and permits retry when an acknowledgement was lost.
- The existing meal/photo RPC flow retains its stable ID and atomic favorite
  save. Its submitted content and favorite choice now remain frozen after the
  first database attempt; upload failures before that point remain editable.
- Favorite update/delete and knowledge create/update/delete use the same store
  mutation path (awaited, acknowledged, per-record busy guard, 20-second abort).
  Knowledge creation uses a stable ID with conflict verification; a draft whose
  title matches a saved item is shown as a replacement and updates that row.
  The favorite editor freezes its submitted patch for retries; knowledge
  deletion requires confirmation, and failures stay visible with retry.

No database migration is required for this batch.

## Verification

- Current unit/component suite (2026-09-15, including the evaluation isolation
  work): 189 tests passed in 27 files. Store tests cover favorite and knowledge
  failure, conflict and retry; page tests cover Knowledge and the favorite editor.
- TypeScript/API checks, lint, production build and `git diff --check` passed.
- Browser scenarios added for this work: manual workout insert retry,
  conflicting insert retry, failed workout editing with note clearing, lost
  delete acknowledgements for meals and workouts, favorite edit and removal
  with lost acknowledgements, and knowledge save and deletion with lost
  acknowledgements. The E2E Vite server now also serves a synthetic
  `/api/knowledge` response. With the 15 proposal scenarios this is
  24 scenarios / 48 desktop and mobile runs.
- 2026-09-15 local run against the disposable Supabase stack (all nine
  migrations applied, no hosted database): 48/48 runs passed. The first full
  run had 46 passes; the meal deletion scenario failed on both viewports
  because its seeded name began with "Delete" and matched the row button as
  well as the delete control. After renaming the seed, that scenario passed on
  both viewports.
- Docker Desktop previously failed to start because stale AF_UNIX socket files
  in `%LOCALAPPDATA%\Docker\run` could not be removed. The folder was renamed to
  `run.stale-20260915` (nothing deleted) and Docker recreated it.

## Limits and next work

- Weight and profile writes keep their earlier awaited/rollback behaviour
  without the per-record guard or abort deadline.
- Stable form IDs and submitted payloads live in the mounted page. This does not
  provide reload/offline recovery, semantic deduplication after reopening a form,
  or a durable queue.
- Ordinary insert retry verification uses the existing business row, not an
  immutable action receipt. It does not prevent recreation after a separate
  deletion of that row.
- Ordinary updates and the existing `record_food_entry` upsert do not yet have
  server-side versions or durable operation receipts. Cross-device edit conflicts
  and a stale meal upsert recreating a deleted record remain separate work.
- Existing meal-editor writes use `record_food_entry`, not the store's addMeal
  or updateMeal methods. Tests distinguish those paths.
- Request cancellation cannot establish whether a server transaction committed;
  errors therefore say the result could not be confirmed and preserve retry data.
- Local E2E passing is not staging or device acceptance. Before release,
  complete staging and physical iPhone acceptance. Nothing has been pushed or
  deployed.
