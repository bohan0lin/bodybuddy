import { afterEach, describe, expect, it, vi } from 'vitest'
import { dateOffset } from './nutrition'

afterEach(() => vi.useRealTimers())

describe('local calendar offsets', () => {
  it.each(['2026-03-10T00:30:00', '2026-11-03T23:30:00'])('keeps seven consecutive dates around DST: %s', (now) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    const dates = Array.from({ length: 7 }, (_, i) => dateOffset(i - 6))
    expect(new Set(dates).size).toBe(7)
    const dayNumbers = dates.map((date) => Date.parse(date + 'T00:00:00Z') / 86_400_000)
    for (let i = 1; i < dayNumbers.length; i++) expect(dayNumbers[i] - dayNumbers[i - 1]).toBe(1)
    expect(dates[6]).toBe(now.slice(0, 10))
  })
})
