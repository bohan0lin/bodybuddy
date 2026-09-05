import { describe, it, expect } from 'vitest'
import { hasHydrationError, shouldInsertDefaultProfile } from './hydration'

describe('hasHydrationError', () => {
  it('is true when any query returned an error', () => {
    expect(hasHydrationError([null, null, { message: 'network' }, null])).toBe(true)
  })
  it('is false when every query is clean', () => {
    expect(hasHydrationError([null, undefined, null])).toBe(false)
  })
})

describe('shouldInsertDefaultProfile', () => {
  it('is true only on a confirmed no-row response (error null, data null)', () => {
    expect(shouldInsertDefaultProfile({ data: null, error: null })).toBe(true)
  })
  it('is false when a profile row exists', () => {
    expect(shouldInsertDefaultProfile({ data: { id: '1' }, error: null })).toBe(false)
  })
  it('does not treat a query error as a no-row response', () => {
    expect(shouldInsertDefaultProfile({ data: null, error: { message: 'network' } })).toBe(false)
  })
})
