import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'
import { z } from 'zod'
import type { Endpoint } from './contracts.js'
import { ApiError, type ApiRequest } from './http.js'

const decisionSchema = z.object({ allowed: z.boolean(), retryAfter: z.number().int().min(0).max(86400) })

export function clientIp(req: ApiRequest): string {
  // Vercel overwrites x-forwarded-for. Other hosts must use the socket address.
  const value = process.env.VERCEL === '1' ? req.headers['x-forwarded-for'] : req.socket?.remoteAddress
  if (typeof value !== 'string' || !isIP(value.trim())) throw new ApiError(503, 'LIMITER_UNAVAILABLE', 'Request limits are temporarily unavailable.')
  let ip = value.trim().toLowerCase()
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7)
  // Normalize alternative IPv6 spellings before hashing.
  if (isIP(ip) === 6) ip = new URL(`http://[${ip}]`).hostname.slice(1, -1)
  return ip
}

export async function reserveRequest(req: ApiRequest, userId: string, endpoint: Endpoint, image: boolean, requestId: string, signal: AbortSignal) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!key || !url) throw new ApiError(503, 'LIMITER_UNAVAILABLE', 'Request limits are temporarily unavailable.')
  const ipHash = createHmac('sha256', key).update('bodybuddy:ai-ip:' + clientIp(req)).digest('hex')
  let decision: z.infer<typeof decisionSchema>
  try {
    // This key is used only for the reservation RPC, never for user-context reads.
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/reserve_ai_request`, {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_user_id: userId, p_ip_hash: ipHash, p_endpoint: endpoint, p_image: image }), signal,
    })
    if (!response.ok) throw new Error('Reservation failed')
    decision = decisionSchema.parse(await response.json())
  } catch {
    console.info(JSON.stringify({ event: 'ai_limit', requestId, endpoint, decision: 'unavailable' }))
    throw new ApiError(503, 'LIMITER_UNAVAILABLE', 'Request limits are temporarily unavailable.')
  }
  console.info(JSON.stringify({ event: 'ai_limit', requestId, endpoint, decision: decision.allowed ? 'allowed' : 'denied', retryAfter: decision.retryAfter }))
  if (!decision.allowed) {
    const error = new ApiError(429, 'RATE_LIMITED', 'Request limit reached. Please try again later.')
    error.retryAfter = Math.max(1, decision.retryAfter)
    throw error
  }
}
