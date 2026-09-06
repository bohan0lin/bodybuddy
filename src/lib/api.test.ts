import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { postJson } from './api'

const getSession = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ supabase: { auth: { getSession } } }))
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null })
})
afterEach(() => vi.unstubAllGlobals())
it('attaches current token and cancellation signal', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ match: null })))
  const controller = new AbortController()
  await postJson('/api/lookup', { name: 'rice' }, controller.signal)
  expect(fetchMock).toHaveBeenCalledWith('/api/lookup', expect.objectContaining({ headers: { 'content-type': 'application/json', Authorization: 'Bearer test-token' }, signal: controller.signal, redirect: 'error' }))
})
it('never sends a token to another origin', async () => {
  await expect(postJson('https://elsewhere.test/api/lookup', {})).rejects.toThrow('Invalid API endpoint')
  expect(fetchMock).not.toHaveBeenCalled()
})
it('does not fetch while signed out', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  await expect(postJson('/api/lookup', {})).rejects.toMatchObject({ status: 401 })
  expect(fetchMock).not.toHaveBeenCalled()
})
it('preserves safe error code and request ID', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Denied', requestId: 'r1' } }), { status: 403 }))
  await expect(postJson('/api/lookup', {})).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', requestId: 'r1' })
})
it('rejects malformed successful output before rendering', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ reply: 'hi', actions: [{ type: 'delete-account' }] })))
  await expect(postJson('/api/assistant', {})).rejects.toMatchObject({ code: 'INVALID_MODEL_RESPONSE' })
})
