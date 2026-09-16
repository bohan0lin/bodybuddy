// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StoreProvider, useStore } from './store'
import { RecordConflict } from '../lib/recordMutations'
import type { ReactNode } from 'react'

type Row = Record<string, unknown>
type Query = { table: string; op: string; payload?: Row; filters: Row; single?: boolean }
const db = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: (table: string) => {
  const query: Query = { table, op: 'read', filters: {} }
  const chain = {
    abortSignal: () => chain,
    select: () => chain,
    eq: (key: string, value: unknown) => { query.filters[key] = value; return chain },
    insert: (payload: Row) => { query.op = 'insert'; query.payload = payload; return chain },
    update: (payload: Row) => { query.op = 'update'; query.payload = payload; return chain },
    delete: () => { query.op = 'delete'; return chain },
    single: () => { query.single = true; return db.query(query) },
    maybeSingle: () => { query.single = true; return db.query(query) },
    then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(db.query(query)).then(resolve, reject),
  }
  return chain
} } }))

const user = 'test-user'
const meal = { date: '2026-09-15', type: 'lunch' as const, name: 'Rice', amount: 100, unit: 'g', protein: 3, carbs: 28, fat: 1, calories: 0 }
const workout = { date: '2026-09-15', type: 'walk', note: '', durationMin: 30, calories: 100 }
let rows: Record<string, Row[]>
function execute(q: Query) {
  const matches = () => (rows[q.table] ?? []).filter(row => Object.entries(q.filters).every(([key, value]) => row[key] === value))
  if (q.op === 'read') return { data: q.single ? matches()[0] ?? null : matches().map(row => ({ ...row })), error: null }
  if (q.op === 'insert') {
    if (rows[q.table].some(row => row.id === q.payload!.id)) return { data: null, error: { code: '23505' } }
    const row = { created_at: '2026-09-15T00:00:00Z', ...q.payload }
    rows[q.table].push(row)
    return { data: row, error: null }
  }
  const found = matches()
  if (q.op === 'update') {
    if (!found.length) return { data: null, error: { code: 'PGRST116' } }
    Object.assign(found[0], q.payload)
    return { data: { ...found[0] }, error: null }
  }
  rows[q.table] = rows[q.table].filter(row => !found.includes(row))
  return { data: null, error: null }
}
beforeEach(() => {
  rows = {
    profiles: [{ id: user, display_name: 'Test', height_cm: 170, target_protein: 100, target_carbs: 200, target_fat: 60, target_calories: 2000 }],
    meals: [{ ...meal, id: 'existing', user_id: user, created_at: '2026-09-15T00:00:00Z' }],
    workouts: [{ id: 'existing', user_id: user, date: workout.date, type: 'walk', note: 'Old note', duration_min: 30, calories: 100, created_at: '2026-09-15T00:00:00Z' }],
    weight_logs: [], saved_items: [], knowledge: [],
  }
  db.query.mockReset().mockImplementation(execute)
})
afterEach(cleanup)
async function mount() {
  const hook = renderHook(useStore, { wrapper: ({ children }: { children: ReactNode }) => <StoreProvider userId={user}>{children}</StoreProvider> })
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook.result
}

it.each(['meals', 'workouts'] as const)('%s keeps confirmed state on create, update and delete failures', async table => {
  const store = await mount()
  const before = store.current[table]
  db.query.mockImplementation(q => q.op === 'read' ? execute(q) : { data: null, error: { message: 'offline' } })
  await act(async () => {
    await expect(table === 'meals' ? store.current.addMeal(meal, 'new') : store.current.addWorkout(workout, 'new')).rejects.toThrow()
    await expect(table === 'meals' ? store.current.updateMeal('existing', { calories: 50 }) : store.current.updateWorkout('existing', { calories: 50 })).rejects.toThrow()
    await expect(table === 'meals' ? store.current.deleteMeal('existing') : store.current.deleteWorkout('existing')).rejects.toThrow()
  })
  expect(store.current[table]).toEqual(before)
})

it.each(['meals', 'workouts'] as const)('%s recovers a committed insert with a lost acknowledgement without duplication', async table => {
  const store = await mount()
  let first = true
  db.query.mockImplementation(q => {
    const result = execute(q)
    if (q.op === 'insert' && first) { first = false; return { data: null, error: { message: 'connection lost' } } }
    return result
  })
  const add = () => table === 'meals' ? store.current.addMeal(meal, 'new') : store.current.addWorkout(workout, 'new')
  await act(async () => { await expect(add()).rejects.toThrow() })
  expect(store.current[table]).toHaveLength(1)
  expect(rows[table]).toHaveLength(2)
  await act(async () => { await add() })
  expect(store.current[table]).toHaveLength(2)
  expect(rows[table]).toHaveLength(2)
  if (table === 'meals') expect(store.current.meals.find(m => m.id === 'new')?.calories).toBe(0)
})

it.each(['meals', 'workouts'] as const)('%s refuses changed content under an existing create ID', async table => {
  const store = await mount()
  await act(async () => {
    if (table === 'meals') {
      await store.current.addMeal(meal, 'new')
      await expect(store.current.addMeal({ ...meal, calories: 999 }, 'new')).rejects.toBeInstanceOf(RecordConflict)
    } else {
      await store.current.addWorkout(workout, 'new')
      await expect(store.current.addWorkout({ ...workout, calories: 999 }, 'new')).rejects.toBeInstanceOf(RecordConflict)
    }
  })
  expect(rows[table].find(row => row.id === 'new')?.calories).not.toBe(999)
})

it('joins identical pending submissions and rejects a concurrent conflicting operation', async () => {
  const store = await mount()
  let release!: () => void
  db.query.mockImplementation(q => q.op === 'insert' ? new Promise(resolve => { release = () => resolve(execute(q)) }) : execute(q))
  await act(async () => {
    const first = store.current.addWorkout(workout, 'new')
    const second = store.current.addWorkout(workout, 'new')
    expect(first).toBe(second)
    await expect(store.current.deleteWorkout('new')).rejects.toThrow('busy')
    release()
    await first
  })
  expect(rows.workouts.filter(row => row.id === 'new')).toHaveLength(1)
})

it.each(['meals', 'workouts'] as const)('%s rejects updates to missing rows and supports repeat deletion', async table => {
  const store = await mount()
  await act(async () => {
    await expect(table === 'meals' ? store.current.updateMeal('missing', { calories: 50 }) : store.current.updateWorkout('missing', { calories: 50 })).rejects.toThrow()
    for (let i = 0; i < 2; i++) await (table === 'meals' ? store.current.deleteMeal('existing') : store.current.deleteWorkout('existing'))
  })
  expect(store.current[table]).toHaveLength(0)
})

it('clears a workout note and publishes the confirmed values', async () => {
  const store = await mount()
  await act(async () => { await store.current.updateWorkout('existing', { note: '', durationMin: 45 }) })
  expect(rows.workouts[0]).toMatchObject({ note: null, duration_min: 45 })
  expect(store.current.workouts[0]).toMatchObject({ note: undefined, durationMin: 45 })
})

it('does not let a delayed refresh resurrect a deleted meal or overwrite a workout update', async () => {
  const store = await mount()
  const releases: (() => void)[] = []
  db.query.mockImplementation(q => {
    const snapshot = execute(q)
    if (q.op === 'read') return new Promise(resolve => releases.push(() => resolve(snapshot)))
    return snapshot
  })
  await act(async () => {
    const refresh = store.current.refreshRecords()
    await waitFor(() => expect(releases).toHaveLength(3))
    await store.current.deleteMeal('existing')
    await store.current.updateWorkout('existing', { durationMin: 45 })
    db.query.mockImplementation(execute)
    releases.forEach(release => release())
    await refresh
  })
  expect(store.current.meals).toHaveLength(0)
  expect(store.current.workouts[0].durationMin).toBe(45)
})

it.each([false, true])('waits for a pending write (failed=%s) and loads independently confirmed meals', async fail => {
  const store = await mount()
  let release!: () => void
  db.query.mockImplementation(q => q.op === 'update' ? new Promise(resolve => {
    release = () => resolve(fail ? { data: null, error: { message: 'offline' } } : execute(q))
  }) : execute(q))
  await act(async () => {
    const write = store.current.updateWorkout('existing', { durationMin: 45 }).catch(() => {})
    await waitFor(() => expect(release).toBeDefined())
    rows.meals.push({ ...rows.meals[0], id: 'agent-meal', name: 'Confirmed elsewhere' })
    let finished = false
    const refresh = store.current.refreshRecords()
    const second = store.current.refreshRecords()
    expect(second).toBe(refresh)
    void refresh.then(() => { finished = true })
    await Promise.resolve()
    expect(finished).toBe(false)
    release()
    await write
    await refresh
  })
  expect(store.current.meals.some(row => row.id === 'agent-meal')).toBe(true)
  expect(store.current.workouts[0].durationMin).toBe(fail ? 30 : 45)
})

it('re-reads when a second refresh arrives during the first snapshot', async () => {
  const store = await mount()
  const releases: (() => void)[] = []
  db.query.mockImplementation(q => {
    const snapshot = execute(q)
    return new Promise(resolve => releases.push(() => resolve(snapshot)))
  })
  await act(async () => {
    const first = store.current.refreshRecords()
    await waitFor(() => expect(releases).toHaveLength(3))
    rows.meals.push({ ...rows.meals[0], id: 'later-confirmation' })
    const second = store.current.refreshRecords()
    db.query.mockImplementation(execute)
    releases.forEach(release => release())
    await Promise.all([first, second])
  })
  expect(store.current.meals.some(row => row.id === 'later-confirmation')).toBe(true)
})

it('reports a current refresh failure and permits a later retry', async () => {
  const store = await mount()
  db.query.mockReturnValue({ data: null, error: { message: 'offline' } })
  await act(async () => { await expect(store.current.refreshRecords()).rejects.toThrow('refresh failed') })
  db.query.mockImplementation(execute)
  rows.meals.push({ ...rows.meals[0], id: 'after-reconnect' })
  await act(async () => { await store.current.refreshRecords() })
  expect(store.current.meals.some(row => row.id === 'after-reconnect')).toBe(true)
})

it('keeps a failed knowledge draft out of the store and recovers a lost insert acknowledgement', async () => {
  const store = await mount()
  const knowledge = { title: 'Recovery', content: 'Rest between sessions.', tags: 'training' }
  let first = true
  db.query.mockImplementation(q => {
    const result = execute(q)
    if (q.op === 'insert' && first) { first = false; return { data: null, error: { message: 'lost response' } } }
    return result
  })
  await act(async () => { await expect(store.current.addKnowledge(knowledge, 'new')).rejects.toThrow() })
  expect(store.current.knowledgeItems).toHaveLength(0)
  expect(rows.knowledge).toHaveLength(1)
  await act(async () => { await store.current.addKnowledge(knowledge, 'new') })
  expect(store.current.knowledgeItems).toHaveLength(1)
  expect(rows.knowledge).toHaveLength(1)
  await act(async () => { await expect(store.current.addKnowledge({ ...knowledge, content: 'Different' }, 'new')).rejects.toBeInstanceOf(RecordConflict) })
  expect(rows.knowledge[0].content).toBe(knowledge.content)
})

it.each(['saved_items', 'knowledge'] as const)('%s failures preserve confirmed data; updates and repeat deletes are acknowledged', async table => {
  rows[table] = table === 'saved_items'
    ? [{ id: 'existing', user_id: user, kind: 'food', name: 'Rice', brand: 'Old brand', unit: 'g', base_amount: 100, protein: 3, carbs: 28, fat: 1, calories: 130, photo_url: 'test-user/photo.jpg' }]
    : [{ id: 'existing', user_id: user, title: 'Old title', content: 'Old content', tags: 'old' }]
  const store = await mount()
  const key = table === 'saved_items' ? 'savedItems' : 'knowledgeItems'
  const before = store.current[key]
  const update = (id = 'existing') => table === 'saved_items'
    ? store.current.updateSavedItem(id, { name: 'New rice', brand: undefined, photoUrl: undefined })
    : store.current.updateKnowledge(id, { title: 'New title', content: 'New content', tags: '' })
  const remove = () => table === 'saved_items' ? store.current.deleteSavedItem('existing') : store.current.deleteKnowledge('existing')
  db.query.mockImplementation(q => q.op === 'read' ? execute(q) : { data: null, error: { message: 'offline' } })
  await act(async () => { await expect(update()).rejects.toThrow(); await expect(remove()).rejects.toThrow() })
  expect(store.current[key]).toEqual(before)
  db.query.mockImplementation(execute)
  await act(async () => { await update(); await expect(update('missing')).rejects.toThrow() })
  if (table === 'saved_items') expect(rows[table][0]).toMatchObject({ name: 'New rice', brand: null, photo_url: null })
  else expect(rows[table][0]).toMatchObject({ title: 'New title', content: 'New content', tags: null })
  await act(async () => { await remove(); await remove() })
  expect(store.current[key]).toHaveLength(0)
})
