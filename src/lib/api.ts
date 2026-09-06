import { supabase } from './supabase'

export class ApiRequestError extends Error {
  status: number
  code: string
  requestId?: string
  retryAfter?: number
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message)
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

// Only send the bearer token to same-origin, known application endpoints.
export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  if (!/^\/api\/(assistant|suggest|recognize|lookup|knowledge)$/.test(url)) throw new Error('Invalid API endpoint')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) throw new ApiRequestError(401, 'UNAUTHORIZED', 'Please sign in again.')
  const controller = new AbortController()
  const cancel = () => controller.abort(signal?.reason)
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => controller.abort(new ApiRequestError(504, 'REQUEST_TIMEOUT', 'Request timed out. Please retry.')), url === '/api/lookup' ? 20_000 : 55_000)
  try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body),
    signal: controller.signal,
    redirect: 'error',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = err?.error
    const failure = new ApiRequestError(res.status, typeof detail?.code === 'string' ? detail.code : 'REQUEST_FAILED', typeof detail?.message === 'string' ? detail.message : `Request failed (${res.status})`, typeof detail?.requestId === 'string' ? detail.requestId : undefined)
    const retry = Number(res.headers.get('Retry-After'))
    if (retry > 0 && Number.isFinite(retry)) failure.retryAfter = retry
    throw failure
  }
  const payload: unknown = await res.json()
  // Lazy-load pure contracts so the initial route does not load Zod for an unused AI request.
  const { responses } = await import('../../api/_lib/contracts')
  const parsed = responses[url.slice(5) as keyof typeof responses].safeParse(payload)
  if (!parsed.success) throw new ApiRequestError(502, 'INVALID_MODEL_RESPONSE', 'AI returned an invalid result. Please retry.')
  return parsed.data as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
