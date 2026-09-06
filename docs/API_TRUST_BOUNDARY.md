# Authenticated AI boundary

## Implementation

All five `/api/assistant`, `/api/suggest`, `/api/recognize`, `/api/lookup` and
`/api/knowledge` entry points use `createEndpoint`. Vite uses the same dispatcher
through a bounded HTTP adapter. Subpath/prefix matches are not accepted.

The browser retrieves the current session access token and sends it only to these
same-origin paths. Redirects are rejected. The server calls Supabase Auth
`getUser(token)` to verify the token; it does not decode a JWT and trust its claims
without verification. See [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
Missing/invalid authentication returns 401, registered-account restrictions return
403, and an unavailable auth service returns 503. Supabase anonymous users cannot
invoke these paid endpoints.

Each request receives a fresh Supabase client carrying that user's bearer token.
All profile/meals/workouts/saved-items/knowledge/weight reads also explicitly filter
by the verified user ID. RLS remains enabled; no service-role credential is needed.
Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` server-side (the existing `VITE_` names
remain supported as fallbacks). Never put a service-role key in either setting.

Assistant and suggestion requests now send `date` (YYYY-MM-DD), `hour` (0–23),
optional `lang`, plus messages or suggestion mode. Client `context` and user ID
fields are rejected. Date/hour are untrusted display context for local-calendar
behavior, never identity or authorization. Context is rebuilt from acknowledged
database records, so unpersisted optimistic UI entries are not authoritative.

## Contracts and limits

Zod validates every request and response. The browser lazily loads the same pure
response contracts before presenting results. Tool inputs use bounded schemas too.
Invalid model output returns 502 and cannot become an actionable client proposal.
RAG matches are checked before grounding. These numeric caps are engineering
sanity bounds, **not dietary recommendations or a complete health-safety layer**.

- JSON body: at most 4 MiB.
- Conversation: at most 40 messages, 8,000 characters per message. Coach sends its
  most recent 39 messages and only the newest image; older messages remain visible.
- Image: JPEG/PNG/WebP only, at most 2 MiB decoded, 4096 pixels per side and
  16 million pixels; actual image metadata must match the declared MIME. Animation
  is rejected. URLs to remote images are not accepted.
- Knowledge ingestion: 8,000 input characters; bounded title/content/tags output.
- Context: seven days of meals/workouts, latest 40 saved items, latest 20 knowledge
  entries, latest weight. More than 500 meals/workouts in that window fails closed
  rather than silently computing incomplete totals. Database pagination/large-account
  behavior should be revisited if the product outgrows these explicit bounds.

Errors have `{ error: { code, message, requestId } }`, an `X-Request-Id` header,
and `Cache-Control: no-store`. Responses never expose exception stacks or SDK
messages. These handlers do not log raw prompts, images, auth headers or SDK errors.

Saved knowledge and account text are placed in an explicitly untrusted user-context
message, outside system instructions. System rules retain proposal-only tools and
confirmation before writes. This reduces instruction confusion; adversarial model
evals and the deterministic health-safety policy remain separate work.

## Verification and rollout

Deterministic tests mock Supabase Auth and model responses. They verify rejection
before model invocation, identity filtering on every context table, safe errors,
schema bounds, image metadata, the Vite adapter, and browser token handling. They
do not prove live Supabase RLS policies or real model injection resistance.

The payload contract changes for assistant/suggest: release frontend and backend
together. Older cached clients will fail closed until updated. No deployment was
performed as part of this change. Verify signed-in browser flows against staging,
and actual RLS using disposable integration tests before production release.

Atomic per-user/IP limits, daily model-call reservations and timeout/cancellation
propagation are implemented in [AI request limits](./AI_REQUEST_LIMITS.md).
Their migration and server environment variable must be configured before rollout.
Next: reliable mutations, full health-safety/privacy work, staging E2E and budgeted
model evals. Hosted CI and deployment remain separate acceptance checks.
