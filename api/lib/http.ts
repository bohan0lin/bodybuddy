import { randomUUID } from 'node:crypto'

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
export interface ApiRequest { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
export interface ApiResponse { status(code: number): ApiResponse; json(value: unknown): void; setHeader(name: string, value: string): unknown }
export function sendError(res: ApiResponse, error: unknown, requestId = randomUUID()) {
  const safe = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Request failed. Please try again.')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Request-Id', requestId)
  if (safe.status === 401) res.setHeader('WWW-Authenticate', 'Bearer')
  res.status(safe.status).json({ error: { code: safe.code, message: safe.message, requestId } })
}
