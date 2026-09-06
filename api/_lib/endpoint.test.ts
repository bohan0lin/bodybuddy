import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEndpoint } from './endpoint.js'
import { authenticate } from './auth.js'
import type { ApiResponse } from './http.js'
import type { Endpoint } from './contracts.js'
import { apiMiddleware } from './dev.js'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ApiError } from './http.js'
import { reserveRequest } from './limits.js'

vi.mock('./limits.js', () => ({ reserveRequest: vi.fn() }))

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createClient: vi.fn(), context: vi.fn(), assistant: vi.fn(), suggest: vi.fn(), recognize: vi.fn(), lookup: vi.fn(), knowledge: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
vi.mock('./context.js', () => ({ loadContext: mocks.context }))
vi.mock('./assistant.js', () => ({ assistantChat: mocks.assistant }))
vi.mock('./ai.js', () => ({ suggestMeal: mocks.suggest, recognizeFood: mocks.recognize }))
vi.mock('./rag.js', () => ({ lookupFoods: mocks.lookup }))
vi.mock('./knowledge.js', () => ({ tidyKnowledge: mocks.knowledge }))

const token = 'test.payload.signature'
const user = { id: 'user-a', role: 'authenticated', is_anonymous: false }
const zero = { protein: 0, carbs: 0, fat: 0, calories: 0 }
const context = { targets: zero, consumed: zero, todayMeals: [], savedItems: [], hour: 12 }
const clock = { date: '2026-09-06', hour: 12 }
const bodies: Record<Endpoint, unknown> = {
  assistant: { messages: [{ role: 'user', text: 'hello' }], ...clock },
  suggest: clock, recognize: { image: 'AAAA', mediaType: 'image/png' }, lookup: { name: 'rice' }, knowledge: { text: 'a note' },
}
function response() {
  const result = { statusCode: 0, body: undefined as unknown, headers: {} as Record<string, string> }
  const res: ApiResponse = { status(code) { result.statusCode = code; return res }, json(body) { result.body = body }, setHeader(key, value) { result.headers[key] = value } }
  return { result, res }
}
async function call(endpoint: Endpoint, authorization: string | string[] | undefined = `Bearer ${token}`, body: unknown = bodies[endpoint], method = 'POST') {
  const { result, res } = response()
  await createEndpoint(endpoint)({ method, headers: { authorization, 'content-type': 'application/json' }, body }, res)
  return result
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(reserveRequest).mockResolvedValue(undefined)
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_ANON_KEY', 'test-public-key')
  mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } })
  mocks.getUser.mockResolvedValue({ data: { user }, error: null })
  mocks.context.mockResolvedValue(context)
  mocks.assistant.mockResolvedValue({ reply: 'hello', actions: [] })
  mocks.suggest.mockResolvedValue({ text: 'suggestion' })
  mocks.lookup.mockResolvedValue([null])
  mocks.knowledge.mockResolvedValue({ relevant: true, title: 'note', content: 'text', tags: '' })
})

describe('all paid endpoint contracts', () => {
  for (const endpoint of Object.keys(bodies) as Endpoint[]) {
    it.each(['', 'Basic x', 'Bearer malformed', 'Bearer one.two', ['Bearer a.b.c', 'Bearer d.e.f']])(`${endpoint}: rejects missing/malformed authorization %s`, async (header) => {
      const result = await call(endpoint, header)
      expect(result.statusCode).toBe(401)
      expect(result.body).toMatchObject({ error: { code: 'UNAUTHORIZED', requestId: expect.any(String) } })
      expect(mocks.getUser).not.toHaveBeenCalled()
      expect(mocks.context).not.toHaveBeenCalled()
      for (const model of [mocks.assistant, mocks.suggest, mocks.recognize, mocks.lookup, mocks.knowledge]) expect(model).not.toHaveBeenCalled()
    })
    it(`${endpoint}: rejects expired/forged tokens before invoking models`, async () => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: 'secret provider detail' } })
      const result = await call(endpoint)
      expect(result.statusCode).toBe(401)
      expect(JSON.stringify(result)).not.toContain('secret provider detail')
      for (const model of [mocks.assistant, mocks.suggest, mocks.recognize, mocks.lookup, mocks.knowledge]) expect(model).not.toHaveBeenCalled()
    })
  }
  it('uses verified identity and a fresh token-scoped client', async () => {
    expect((await call('assistant')).statusCode).toBe(200)
    expect(mocks.getUser).toHaveBeenCalledWith(token)
    expect(mocks.createClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-public-key', expect.objectContaining({ global: expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } }) }))
    expect(mocks.context).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-a' }), clock.date, clock.hour)
    expect(mocks.assistant).toHaveBeenCalledWith(expect.objectContaining({ context }), expect.any(AbortSignal))
  })
  it.each([{ userId: 'user-b' }, { context: { userId: 'user-b', targets: zero } }])('rejects client identity/context injection', async (extra) => {
    expect((await call('assistant', `Bearer ${token}`, { ...(bodies.assistant as object), ...extra })).statusCode).toBe(400)
    expect(mocks.context).not.toHaveBeenCalled()
    expect(mocks.assistant).not.toHaveBeenCalled()
  })
  it('returns 403 for anonymous users', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...user, is_anonymous: true } }, error: null })
    expect((await call('knowledge')).statusCode).toBe(403)
    expect(mocks.knowledge).not.toHaveBeenCalled()
  })
  it('fails closed on auth service outage', async () => {
    mocks.getUser.mockRejectedValue(new Error('private outage details'))
    expect((await call('knowledge')).statusCode).toBe(503)
  })
  it('rejects missing authorization header', async () => {
    await expect(authenticate({})).rejects.toMatchObject({ status: 401 })
  })
  it.each(['lookup', 'suggest', 'knowledge'] as Endpoint[])('accepts valid %s requests', async (endpoint) => {
    expect((await call(endpoint)).statusCode).toBe(200)
  })
  it('rejects malformed JSON, unknown fields, invalid images and method', async () => {
    expect((await call('knowledge', `Bearer ${token}`, '{')).statusCode).toBe(400)
    expect((await call('knowledge', `Bearer ${token}`, { text: 'hi', userId: 'b' })).statusCode).toBe(400)
    expect((await call('recognize')).statusCode).toBe(400)
    expect(mocks.recognize).not.toHaveBeenCalled()
    expect((await call('lookup', `Bearer ${token}`, {}, 'GET')).statusCode).toBe(405)
  })
  it('rejects invalid model actions before returning to the client', async () => {
    mocks.assistant.mockResolvedValue({ reply: 'ok', actions: [{ type: 'log', name: 'rice', mealType: 'snack', ...zero, calories: -1 }] })
    expect((await call('assistant')).statusCode).toBe(502)
  })
  it('never returns internal model exception details', async () => {
    mocks.knowledge.mockRejectedValue(new Error('secret-key and private prompt'))
    const result = await call('knowledge')
    expect(result.statusCode).toBe(500)
    expect(JSON.stringify(result)).not.toContain('secret-key')
    expect(result.headers['Cache-Control']).toBe('no-store')
    expect(result.body).toMatchObject({ error: { requestId: result.headers['X-Request-Id'] } })
  })
  it('the development adapter enforces the same auth boundary', async () => {
    const req = Object.assign(Readable.from([JSON.stringify(bodies.knowledge)]), { url: '/api/knowledge', method: 'POST', headers: { 'content-type': 'application/json' } }) as unknown as IncomingMessage
    const end = vi.fn()
    const res = { setHeader: vi.fn(), end, statusCode: 0, once: vi.fn(), off: vi.fn() } as unknown as ServerResponse
    const next = vi.fn()
    await apiMiddleware(req, res, next)
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(end.mock.calls[0][0])).toMatchObject({ error: { code: 'UNAUTHORIZED' } })
    expect(mocks.knowledge).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })
  it('does not match endpoint name prefixes in development', async () => {
    const req = { url: '/api/knowledge-extra' } as IncomingMessage
    const next = vi.fn()
    await apiMiddleware(req, {} as ServerResponse, next)
    expect(next).toHaveBeenCalledOnce()
  })
  it('returns retry hints and never calls models when the budget is exhausted', async () => {
    const denied = new ApiError(429, 'RATE_LIMITED', 'Please retry later.')
    denied.retryAfter = 40
    vi.mocked(reserveRequest).mockRejectedValue(denied)
    const result = await call('knowledge')
    expect(result.statusCode).toBe(429)
    expect(result.headers['Retry-After']).toBe('40')
    expect(mocks.knowledge).not.toHaveBeenCalled()
  })
  it('validates malformed input before reserving quota', async () => {
    await call('knowledge', `Bearer ${token}`, { text: '' })
    expect(reserveRequest).not.toHaveBeenCalled()
  })
  it('returns a timeout and aborts the model signal when the provider stalls', async () => {
    vi.useFakeTimers()
    try {
      mocks.knowledge.mockReturnValue(new Promise(() => {}))
      const pending = call('knowledge')
      await vi.advanceTimersByTimeAsync(45_000)
      expect((await pending).statusCode).toBe(504)
      expect(mocks.knowledge.mock.calls[0][2].aborted).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    } finally { vi.useRealTimers() }
  })
})
