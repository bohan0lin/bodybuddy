import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types.js'
import { ApiError, type ApiRequest } from './http.js'

export async function authenticate(headers: ApiRequest['headers'], signal?: AbortSignal) {
  const header = headers.authorization
  if (typeof header !== 'string' || header.length > 8192 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(header)) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
  }
  const token = header.slice(7)
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable.')
  // Per-request client with the user's token: RLS remains in force. Never use a service-role key.
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, signal }) },
  })
  let result: Awaited<ReturnType<typeof db.auth.getUser>>
  try { result = await db.auth.getUser(token) } catch { throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable.') }
  if (result.error) {
    if (!result.error.status || result.error.status >= 500 || result.error.status === 429) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable.')
    throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
  }
  if (!result.data.user) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in again.')
  if (result.data.user.is_anonymous || result.data.user.role !== 'authenticated') throw new ApiError(403, 'FORBIDDEN', 'A registered account is required.')
  return { userId: result.data.user.id, db }
}
export type Identity = Awaited<ReturnType<typeof authenticate>>
