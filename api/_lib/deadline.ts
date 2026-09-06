import { ApiError } from './http.js'

export function deadline(milliseconds: number, external?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort(new ApiError(499, 'REQUEST_CANCELLED', 'Request cancelled.'))
  const timer = setTimeout(() => controller.abort(new ApiError(504, 'REQUEST_TIMEOUT', 'Request timed out. Please retry.')), milliseconds)
  if (external?.aborted) abort()
  else external?.addEventListener('abort', abort, { once: true })
  return {
    signal: controller.signal,
    cancel: abort,
    dispose() { clearTimeout(timer); external?.removeEventListener('abort', abort) },
  }
}

export async function withinDeadline<T>(signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  if (signal.aborted) throw signal.reason
  let abort: () => void = () => {}
  const cancelled = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }) })
  try { return await Promise.race([work(), cancelled]) }
  finally { signal.removeEventListener('abort', abort) }
}
