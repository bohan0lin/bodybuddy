import { afterEach, expect, it, vi } from 'vitest'
import { withRecordTimeout } from './recordMutations'

afterEach(() => vi.useRealTimers())

it('aborts a stalled database request and clears its timer', async () => {
  vi.useFakeTimers()
  let signal!: AbortSignal
  const pending = withRecordTimeout(current => {
    signal = current
    return new Promise((_, reject) => current.addEventListener('abort', () => reject(new Error('Request aborted'))))
  })
  const failure = expect(pending).rejects.toThrow('Request aborted')
  await vi.advanceTimersByTimeAsync(20_000)
  await failure
  expect(signal.aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('clears the deadline after a successful write', async () => {
  vi.useFakeTimers()
  await expect(withRecordTimeout(async () => 'saved')).resolves.toBe('saved')
  expect(vi.getTimerCount()).toBe(0)
})
