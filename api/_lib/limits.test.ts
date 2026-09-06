import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clientIp, reserveRequest } from './limits.js'
import { deadline, withinDeadline } from './deadline.js'

beforeEach(() => {
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-server-key')
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers() })
const req = { headers: { 'x-forwarded-for': '203.0.113.9' }, socket: { remoteAddress: '127.0.0.1' } }

it('ignores forwarded headers outside Vercel and normalizes IPv6', () => {
  expect(clientIp(req)).toBe('127.0.0.1')
  expect(clientIp({ headers: {}, socket: { remoteAddress: '::ffff:127.0.0.1' } })).toBe('127.0.0.1')
  expect(clientIp({ headers: {}, socket: { remoteAddress: '0:0:0:0:0:0:0:1' } })).toBe('::1')
  vi.stubEnv('VERCEL', '1')
  expect(clientIp(req)).toBe('203.0.113.9')
  expect(() => clientIp({ headers: { 'x-forwarded-for': 'spoof, 203.0.113.9' } })).toThrow()
})
it('sends an IP hash and verified identity, never a raw IP', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ allowed: true, retryAfter: 0 })))
  vi.stubGlobal('fetch', fetchMock)
  await reserveRequest(req, 'user-a', 'assistant', true, 'r1', new AbortController().signal)
  const body = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(body).toMatchObject({ p_user_id: 'user-a', p_endpoint: 'assistant', p_image: true })
  expect(body.p_ip_hash).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(body)).not.toContain('127.0.0.1')
  expect(console.info).toHaveBeenCalledWith(expect.not.stringContaining('synthetic-server-key'))
})
it('fails closed on missing configuration and reservation errors', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('error', { status: 500 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(reserveRequest(req, 'a', 'lookup', false, 'r1', new AbortController().signal)).rejects.toMatchObject({ status: 503 })
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
  fetchMock.mockClear()
  await expect(reserveRequest(req, 'a', 'lookup', false, 'r1', new AbortController().signal)).rejects.toMatchObject({ status: 503 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('turns denied quota into a 429 with a retry delay', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ allowed: false, retryAfter: 60 }))))
  await expect(reserveRequest(req, 'a', 'lookup', false, 'r1', new AbortController().signal)).rejects.toMatchObject({ status: 429, retryAfter: 60 })
})
it('ends a stalled request at its deadline and cancels upstream work', async () => {
  vi.useFakeTimers()
  const life = deadline(100)
  const pending = withinDeadline(life.signal, () => new Promise(() => {}))
  const assertion = expect(pending).rejects.toMatchObject({ status: 504 })
  await vi.advanceTimersByTimeAsync(100)
  await assertion
  expect(life.signal.aborted).toBe(true)
  life.dispose()
  expect(vi.getTimerCount()).toBe(0)
})
it('honors client cancellation and clears timer/listeners', async () => {
  vi.useFakeTimers()
  const external = new AbortController()
  const life = deadline(100, external.signal)
  const pending = withinDeadline(life.signal, () => new Promise(() => {}))
  const assertion = expect(pending).rejects.toMatchObject({ status: 499 })
  external.abort()
  await assertion
  life.dispose()
  expect(vi.getTimerCount()).toBe(0)
})
