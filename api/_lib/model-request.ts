import { APICallError, NoObjectGeneratedError } from 'ai'
import { setTimeout as delay } from 'node:timers/promises'
import { ApiError } from './http.js'

export function publicModelError(error: unknown): unknown {
  if (NoObjectGeneratedError.isInstance(error)) {
    return new ApiError(502, 'INVALID_MODEL_RESPONSE', 'AI could not produce a valid result. Please retry.')
  }
  if (!APICallError.isInstance(error)) return error
  if (error.statusCode === 429) {
    return new ApiError(503, 'AI_RATE_LIMITED', 'The AI provider is rate-limited or out of quota. Please try again later.')
  }
  if ([401, 403, 404].includes(error.statusCode ?? 0)) {
    return new ApiError(503, 'AI_CONFIGURATION_ERROR', 'The AI service configuration needs attention.')
  }
  if (error.statusCode !== undefined && error.statusCode >= 500) {
    return new ApiError(503, 'AI_UNAVAILABLE', 'The AI service is temporarily unavailable. Please try again shortly.')
  }
  return new ApiError(502, 'AI_REQUEST_REJECTED', 'The AI provider could not process this request. Please retry.')
}

// Retry temporary provider failures once, within the original request deadline.
// Never log SDK errors: they can contain the image, credentials and response text.
export async function recognitionModelRequest<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted()
    try { return await work() }
    catch (error) {
      signal?.throwIfAborted()
      if (attempt === 0 && APICallError.isInstance(error) && [500, 502, 503, 504].includes(error.statusCode ?? 0)) {
        try { await delay(500, undefined, { signal }) }
        catch { signal?.throwIfAborted(); throw error }
        continue
      }
      throw publicModelError(error)
    }
  }
}
