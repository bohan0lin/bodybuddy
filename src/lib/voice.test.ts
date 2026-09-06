import { describe, it, expect, vi, afterEach } from 'vitest'
import { createVoiceController, finalizeVoiceState, type Recognition } from './voice'

afterEach(() => vi.useRealTimers())

function setup() {
  vi.useFakeTimers()
  const state = vi.fn()
  const text = vi.fn()
  const rec: Recognition = { onresult: null, onerror: null, onend: null, start: vi.fn(), stop: vi.fn(), abort: vi.fn() }
  const controller = createVoiceController(state, text)
  return { state, text, rec, controller }
}

describe('recognition sessions', () => {
  it('starts only explicitly and cleans up a result', () => {
    const { state, text, rec, controller } = setup()
    expect(rec.start).not.toHaveBeenCalled()
    controller.start(rec)
    rec.onresult!({ results: [[{ transcript: 'rice' }]] })
    expect(text).toHaveBeenCalledWith('rice')
    expect(state).toHaveBeenLastCalledWith('idle')
    expect(rec.onend).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each([true, false])('manual stop with result=%s terminates', (hasResult) => {
    const { state, rec, controller } = setup()
    controller.start(rec)
    controller.stop()
    expect(state).toHaveBeenLastCalledWith('processing')
    if (hasResult) rec.onresult!({ results: [[{ transcript: 'rice' }]] })
    else rec.onend!()
    expect(state).toHaveBeenLastCalledWith('idle')
  })
  it('handles synchronous onend from stop', () => {
    const { state, rec, controller } = setup()
    rec.stop = () => rec.onend?.()
    controller.start(rec)
    controller.stop()
    expect(state).toHaveBeenLastCalledWith('idle')
  })
  it('permission errors preserve transcript and permit retry', () => {
    const { state, text, rec, controller } = setup()
    controller.start(rec)
    rec.onerror!()
    expect(state).toHaveBeenLastCalledWith('error')
    expect(text).not.toHaveBeenCalled()
    controller.start(rec)
    expect(state).toHaveBeenLastCalledWith('listening')
  })
  it.each([true, false])('fails safe without browser events after stop=%s', (stop) => {
    const { state, rec, controller } = setup()
    controller.start(rec)
    if (stop) controller.stop()
    vi.advanceTimersByTime(stop ? 5_000 : 60_000)
    expect(state).toHaveBeenLastCalledWith('error')
    expect(rec.onresult).toBeNull()
  })
  it('ignores queued events after replacement or unmount', () => {
    const { state, text, rec, controller } = setup()
    controller.start(rec)
    const lateResult = rec.onresult!
    const next = { ...rec, start: vi.fn(), abort: vi.fn() }
    controller.start(next)
    lateResult({ results: [[{ transcript: 'stale' }]] })
    expect(text).not.toHaveBeenCalled()
    const lateEnd = next.onend!
    controller.dispose()
    state.mockClear()
    lateEnd()
    vi.runAllTimers()
    expect(state).not.toHaveBeenCalled()
    expect(next.onresult).toBeNull()
  })
  it('recovers if the browser throws on start or stop', () => {
    const { state, rec, controller } = setup()
    rec.start = () => { throw new Error('denied') }
    controller.start(rec)
    expect(state).toHaveBeenLastCalledWith('error')
    rec.start = vi.fn()
    rec.stop = () => { throw new Error('ended') }
    controller.start(rec)
    controller.stop()
    expect(state).toHaveBeenLastCalledWith('error')
  })
})

describe('finalizeVoiceState', () => {
  it('resets processing to idle (manual stop with no onresult/onerror)', () => {
    expect(finalizeVoiceState('processing')).toBe('idle')
  })
  it('resets listening to idle', () => {
    expect(finalizeVoiceState('listening')).toBe('idle')
  })
  it('keeps an error state', () => {
    expect(finalizeVoiceState('error')).toBe('error')
  })
  it('keeps idle', () => {
    expect(finalizeVoiceState('idle')).toBe('idle')
  })
})
