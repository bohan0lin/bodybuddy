import { describe, it, expect } from 'vitest'
import { finalizeVoiceState } from './voice'

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
