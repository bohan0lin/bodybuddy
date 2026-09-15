import { expect, it } from 'vitest'
import { addDays, buildStagingAccounts, localDate } from './data.mjs'

const today = '2026-03-01'
const accounts = buildStagingAccounts(today)
const tables = ['weight_logs', 'meals', 'workouts', 'saved_items', 'knowledge']

it('builds empty, partial and full synthetic accounts on a reserved test domain', () => {
  expect(accounts.map((account) => account.label)).toEqual(['empty', 'partial', 'full'])
  expect(accounts.every((account) => account.email.endsWith('@bodybuddy.test'))).toBe(true)
  expect(tables.every((table) => accounts[0][table].length === 0) && accounts[0].profile === null).toBe(true)
  expect(accounts[2].meals.filter((row) => row.date === today)).toHaveLength(2)
})

it('uses only valid, unowned rows dated within the context window', () => {
  const rows = accounts.flatMap((account) => tables.flatMap((table) => account[table].map((row) => ({ table, row }))))
  expect(rows.every(({ row }) => !('user_id' in row) && !('id' in row) && !('photo_url' in row))).toBe(true)
  for (const { table, row } of rows.filter(({ row }) => row.date)) {
    expect(row.date <= today).toBe(true)
    expect(row.date >= addDays(today, table === 'weight_logs' ? -13 : -6)).toBe(true)
  }
  expect(accounts.flatMap((account) => account.meals).every((row) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(row.type) && row.calories >= 0)).toBe(true)
  expect(accounts.flatMap((account) => account.workouts).every((row) => ['strength', 'run', 'walk'].includes(row.type) && row.duration_min > 0)).toBe(true)
  for (const account of accounts) {
    expect(new Set(account.weight_logs.map((row) => row.date)).size).toBe(account.weight_logs.length)
    expect(new Set(account.knowledge.map((row) => row.title)).size).toBe(account.knowledge.length)
  }
})

it('handles month boundaries and rejects malformed dates', () => {
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(localDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  expect(() => buildStagingAccounts('03/01/2026')).toThrow('YYYY-MM-DD')
})
