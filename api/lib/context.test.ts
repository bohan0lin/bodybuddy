import { describe, expect, it, vi } from 'vitest'
import { loadContext } from './context.js'
import type { Identity } from './auth.js'

function database(failure?: string) {
  const filters: Array<[string, string, string]> = []
  const rows = {
    profiles: { target_protein: 100, target_carbs: 200, target_fat: 60, target_calories: 2000 },
    meals: [{ date: '2026-09-06', name: 'rice', type: 'lunch', protein: 3, carbs: 30, fat: 1, calories: 141 }],
    workouts: [], saved_items: [], knowledge: [], weight_logs: [],
  } as Record<string, unknown>
  const from = vi.fn((table: string) => {
    const query = {
      select: () => query,
      eq: (key: string, id: string) => { filters.push([table, key, id]); return query },
      gte: () => query, lte: () => query, order: () => query, limit: () => query, single: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows[table], error: table === failure ? { message: 'failure' } : null }).then(resolve),
    }
    return query
  })
  return { db: { from } as unknown as Identity['db'], filters, rows }
}

describe('server-owned context', () => {
  it.each(['user-a', 'user-b'])('scopes all six tables to verified %s', async (userId) => {
    const { db, filters } = database()
    const result = await loadContext({ db, userId }, '2026-09-06', 12)
    expect(filters).toHaveLength(6)
    expect(filters.every(([table, key, id]) => key === (table === 'profiles' ? 'id' : 'user_id') && id === userId)).toBe(true)
    expect(result.targets.calories).toBe(2000)
    expect(result.consumed.calories).toBe(141)
    expect(result.recentDays).toHaveLength(7)
    expect(result.recentDays?.[0].date).toBe('2026-08-31')
  })
  it('does not treat partial read failure as empty context', async () => {
    const { db } = database('knowledge')
    await expect(loadContext({ db, userId: 'a' }, '2026-09-06', 12)).rejects.toMatchObject({ code: 'CONTEXT_UNAVAILABLE' })
  })
  it('rejects invalid stored enums and overflow rather than guessing', async () => {
    const { db, rows } = database()
    rows.meals = [{ date: '2026-09-06', name: 'x', type: 'invalid', protein: 1, carbs: 1, fat: 1, calories: 1 }]
    await expect(loadContext({ db, userId: 'a' }, '2026-09-06', 12)).rejects.toMatchObject({ code: 'CONTEXT_UNAVAILABLE' })
    rows.meals = Array.from({ length: 501 }, () => ({ date: '2026-09-06', name: 'x', type: 'lunch', protein: 1, carbs: 1, fat: 1, calories: 1 }))
    await expect(loadContext({ db, userId: 'a' }, '2026-09-06', 12)).rejects.toMatchObject({ code: 'CONTEXT_UNAVAILABLE' })
  })
})
