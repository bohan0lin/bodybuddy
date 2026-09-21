import { ApiError } from '../api/_lib/http'

// Never persist provider error messages or bodies: they may contain request data.
export function failureDetail(error: unknown): string {
  if (error instanceof ApiError) {
    const codes = ['AI_UNAVAILABLE', 'AI_RATE_LIMITED', 'AI_CONFIGURATION_ERROR', 'AI_REQUEST_REJECTED', 'INVALID_MODEL_RESPONSE']
    return codes.includes(error.code) ? `Provider failure: ${error.code} (HTTP ${error.status})` : 'Application request failed'
  }
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return 'Case deadline exceeded or request aborted'
  return 'Provider or result processing failed; no safe error classification available'
}
