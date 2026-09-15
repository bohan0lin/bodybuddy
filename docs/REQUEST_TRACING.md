# Request tracing

Updated: 2026-09-15. Implements the minimal execution record in section 5.1 of the
[technical improvement plan](./TECHNICAL_IMPROVEMENT_PLAN.md). No database table,
task system or client telemetry was added.

## What is emitted

Every call to the five AI endpoints (`assistant`, `suggest`, `recognize`, `lookup`,
`knowledge`) writes exactly one JSON line through `console.info` when it ends
(`api/_lib/trace.ts`, used by `api/_lib/endpoint.ts`):

| Field | Meaning |
|---|---|
| `event` | Always `ai_request` (the existing `ai_limit` line is unchanged) |
| `requestId` | Same value as the `X-Request-Id` header and the error body `requestId` |
| `endpoint` | Endpoint name |
| `outcome` | `completed`, `failed`, `cancelled` (client disconnected) or `timeout` |
| `status`, `code` | HTTP status and the public `ApiError` code; unexpected errors are `INTERNAL_ERROR` |
| `failedStage` | Stage whose error ended the request: `validation`, `auth`, `limit`, `context`, `model`, `retrieval`, `output`, or `request` before any stage |
| `durationMs` | Total handler time |
| `steps` | Ordered `{ stage, ms, outcome, code? }` for each finished stage |
| `model`, `promptVersion` | Provider/model ID and the first 12 hex characters of the SHA-256 of the system prompt |
| `retrievalVersion` | `RETRIEVAL_VERSION`, present when nutrition retrieval ran |
| `inputTokens`, `outputTokens` | Provider-reported totals across model steps |
| `proposals`, `actionIds` | Assistant only: number and IDs of returned proposals |

Nested stages are recorded separately: an assistant lookup appears as a
`retrieval` step before its enclosing `model` step. A retrieval error that the
model recovers from appears in `steps` but does not become `failedStage`. When the
deadline fires while a stage is still running, the request has
`outcome: "timeout"` and `failedStage` names that stage; the unfinished stage has
no entry in `steps`.

System prompts contain no account data, so `promptVersion` changes when prompt
text changes and differs between the Chinese and English variants.

## Correlation

- A user-reported error shows `requestId`; search runtime logs for it.
- `actionIds` link an assistant request to `agent_actions.action_id` rows. A row
  with that ID means the user confirmed and the write committed; no row means the
  proposal is still pending, was cancelled, or was never confirmed.
- Not yet recorded: client-side confirmation attempts, retries, and record refresh
  failures after a successful write. Those states exist only in the page.

## Privacy boundary

The line never includes messages, replies, images, food names, nutrition or body
values, saved knowledge, user IDs, IP addresses, auth headers, keys, or provider
error text. `endpoint.test.ts` and `trace.test.ts` assert that sample content,
the user ID, token and provider exception text do not appear.

Estimated cost is not logged: the application has no verified model pricing.
Because nothing replayable is stored, replay is not supported; reproduce a
problem with the evaluation harness and mocked tools instead of re-running writes.

## Retention, access and deletion

Lines go to the host's runtime logs (Vercel in production, the terminal in local
development). This repository does not configure a log drain or any persistent
log store, so retention and access are whatever the Vercel project's runtime log
settings allow; check them before relying on older traces. The logs cannot be
deleted per user, which is why they contain no user identifier or content.
