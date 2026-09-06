# AI request limits and cancellation

## Policy

The API reserves quota before calling any model, after authentication, JSON/schema
validation and image inspection. Counters live in private Supabase tables and are
shared across Vercel instances. A security-definer RPC acquires advisory locks in
consistent order, checks all limits, then charges all buckets atomically. Denied
requests change no counters. Anonymous and authenticated database roles cannot
execute the RPC or access counters; only the server service role can reserve.

| Counter | Limit | Window |
| --- | ---: | --- |
| Requests per user | 10 | UTC minute |
| Requests per IP | 60 | UTC minute |
| Model-call reservations per user | 100 | UTC day |
| Image requests per user | 3 | UTC minute |
| Image requests per IP | 10 | UTC minute |
| Image requests per user | 20 | UTC day |

These are fixed windows, so traffic around a boundary can span two window limits.
An assistant message with an image uses image quotas, just like recognition.
Assistant requests reserve four model calls (up to four tool steps); recognition
reserves six (generation plus up to five embedding calls); other endpoints reserve
one. Model retries are disabled and generation output is limited to 2048 tokens
per step. Reservations are conservative ceilings, not measured usage or a dollar
budget. Failed/cancelled calls retain their reservation: the provider may have
already processed them. This prevents retry/refund races from exceeding the cap.

Existing payload bounds remain in force: 4 MiB JSON, 40 messages, 8000 characters
per message, 2 MiB decoded images, 4096 pixels per side, supported image MIME types
and matching decoded metadata. No raw prompts/images are stored in counters.

## IP and privacy

On Vercel the trusted, platform-overwritten `x-forwarded-for` supplies the IP.
See [Vercel request headers](https://vercel.com/docs/headers/request-headers).
Outside Vercel the socket address is used and forwarded headers are ignored.
Missing, invalid or multi-valued addresses fail closed. IPv4-mapped IPv6 and
alternative IPv6 spellings are normalized. Additional reverse proxies are not
automatically trusted; clients behind one may share its IP quota.

The IP is HMAC-hashed server-side with a domain-separated label and the server
secret. Changing that secret resets IP identities but does not reset user quotas.
Logs contain only event name, endpoint, requestId, allowed/denied/unavailable and
retry delay. They contain neither user IDs nor IPs, keys, prompts or SDK errors.
Expired counter rows become eligible for cleanup one day after expiry; each
allowed reservation removes up to 200 eligible rows. Cleanup is traffic-driven,
not a guarantee of deletion at an exact time when the app is idle.

## Timeouts and cancellation

Lookup has a 15-second server deadline; other endpoints have 45 seconds. Vercel's
function ceiling is 60 seconds so the API can return its own safe 504 first.
Deadlines and connection aborts cancel Supabase HTTP requests and model/embedding
calls. The response deadline also handles a provider promise that never settles.
Browser requests use 20/55-second fetch timeouts and accept an external AbortSignal.
429 responses include Retry-After; ApiRequestError exposes retryAfter to callers.
Client cancellation cannot guarantee that a provider will not charge work already
accepted upstream.

## Deployment order

1. Apply `supabase/migrations/20260906000500_ai_request_limits.sql` to the target
   Supabase project through the operator-approved migration process. Do not run
   a reset against a remote database. The additive migration is repeatable.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel's server environment for that same
   project, alongside the existing Supabase URL and anon/publishable key. Never
   use a VITE_ prefix for the service key, commit it, or paste it into chat.
3. Deploy frontend and API together. Verify valid calls, 429 retry hints and
   blocked invalid requests on staging before a production release.

The privileged key is used only in the reservation RPC client. Account data is
still loaded using the verified user's own bearer token and RLS. If the key,
migration or database is unavailable, the API returns 503 and does not invoke a
paid model. No service-key fallback or in-memory bypass is provided.

This implementation reuses Postgres instead of adding Redis: no extra service or
subscription is required, but each valid AI request adds a database transaction,
latency and database usage. At higher traffic, measure lock contention and database
capacity before moving counters to a dedicated store. No current provider price or
free-tier capacity is assumed.

## Verification

Database CI covers RPC privileges, private-table access, image quotas, shared IP
limits, expired buckets, failed reservations and concurrent daily reservations.
Core CI covers trusted IP handling, redaction, missing configuration, safe 429s,
timeouts, cancellation and rejection before model invocation. Model calls are
mocked in deterministic tests. Remote deployment and live-provider behavior have
not been verified by these local checks.

API helpers and their tests are under `api/_lib`, which Vercel excludes as function
entries. Root tsconfig explicitly declares Node types and ES2023, and
`scripts/check-api-build.mjs` checks the five actual entries with those options,
independently of project-reference typechecking. This is an offline compiler
check, not a substitute for a completed Vercel deployment.
