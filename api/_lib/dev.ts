import type { IncomingMessage, ServerResponse } from 'node:http'
import { createEndpoint } from './endpoint.js'
import { MAX_BODY_BYTES, requests, type Endpoint } from './contracts.js'
import { ApiError, sendError, type ApiResponse } from './http.js'

export async function apiMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const route = (req.url ?? '').split('?')[0]
  const name = route.slice('/api/'.length)
  if (!route.startsWith('/api/') || !Object.prototype.hasOwnProperty.call(requests, name)) return next()
  const response: ApiResponse = {
    get writableEnded() { return res.writableEnded },
    once: (event, listener) => res.once(event, listener),
    off: (event, listener) => res.off(event, listener),
    setHeader: (key, value) => res.setHeader(key, value),
    status(code) { res.statusCode = code; return response },
    json(value) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)) },
  }
  try {
    const chunks: Buffer[] = []
    let bytes = 0
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk)
      bytes += buffer.length
      if (bytes > MAX_BODY_BYTES) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.')
      chunks.push(buffer)
    }
    await createEndpoint(name as Endpoint)({ method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString(), socket: req.socket, once: (event, listener) => req.once(event, listener), off: (event, listener) => req.off(event, listener) }, response)
  } catch (error) { sendError(response, error) }
}
