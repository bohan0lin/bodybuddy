import { describe, it, expect } from 'vitest'
import { bmi, distinctDaysInMonth, trackingStreak } from './insights'

describe('trackingStreak', () => {
  it('counts consecutive tracked days ending today', () => {
    expect(trackingStreak(new Set(['2026-09-04', '2026-09-03', '2026-09-02']), '2026-09-04')).toBe(3)
  })
  it('allows the streak to end yesterday when today is empty', () => {
    expect(trackingStreak(new Set(['2026-09-03', '2026-09-02']), '2026-09-04')).toBe(2)
  })
  it('is 0 when neither today nor yesterday is tracked', () => {
    expect(trackingStreak(new Set(['2026-09-01']), '2026-09-04')).toBe(0)
  })
  it('stops at the first gap', () => {
    expect(trackingStreak(new Set(['2026-09-04', '2026-09-02', '2026-09-01']), '2026-09-04')).toBe(1)
  })
  it('handles a month boundary', () => {
    expect(trackingStreak(new Set(['2026-09-01', '2026-08-31', '2026-08-30']), '2026-09-01')).toBe(3)
  })
})

describe('distinctDaysInMonth', () => {
  it('counts distinct dates within the month prefix, ignoring duplicates and other months', () => {
    expect(distinctDaysInMonth(['2026-09-01', '2026-09-01', '2026-09-02', '2026-08-31'], '2026-09')).toBe(2)
  })
  it('is 0 when nothing matches', () => {
    expect(distinctDaysInMonth(['2026-08-31'], '2026-09')).toBe(0)
  })
})

describe('bmi', () => {
  it('computes BMI rounded to one decimal', () => {
    expect(bmi(68.2, 172)).toBeCloseTo(23.1, 1)
  })
  it('returns null for missing or non-positive inputs', () => {
    expect(bmi(0, 172)).toBeNull()
    expect(bmi(68, 0)).toBeNull()
    expect(bmi(undefined, 172)).toBeNull()
    expect(bmi(68, undefined)).toBeNull()
  })
})
