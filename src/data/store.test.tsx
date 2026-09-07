// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreProvider, useStore } from './store'

const db = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), upsert: vi.fn(), results: {} as Record<string, { data: unknown; error: unknown }>, created: { data: null, error: null } as { data: unknown; error: unknown } }))
vi.mock('../lib/supabase', () => ({ supabase: { from: db.from } }))
const profile = { display_name: 'Test', height_cm: 170, target_protein: 100, target_carbs: 200, target_fat: 60, target_calories: 2000 }

function View() {
  const store = useStore()
  if (store.loading) return <p>loading</p>
  if (store.hydrationError) return <button onClick={store.reload}>retry</button>
  return <input aria-label="target" value={store.profile.targetCalories} readOnly />
}
function mount() { return render(<StoreProvider userId="test-user"><View /></StoreProvider>) }

beforeEach(() => {
  db.insert.mockReset()
  db.upsert.mockReset()
  db.results = Object.fromEntries(['profiles', 'weight_logs', 'meals', 'saved_items', 'workouts', 'knowledge'].map((name) => [name, { data: name === 'profiles' ? profile : [], error: null }]))
  db.created = { data: { ...profile, target_calories: 0, target_protein: 0, target_carbs: 0, target_fat: 0 }, error: null }
  db.from.mockImplementation((table: string) => ({
    select: () => ({ eq: () => table === 'profiles' ? { maybeSingle: () => Promise.resolve(db.results[table]) } : Promise.resolve(db.results[table]) }),
    insert: (row: unknown) => {
      db.insert(row)
      return { select: () => ({ single: () => Promise.resolve(db.created) }) }
    },
    upsert: (...args: unknown[]) => {
      db.upsert(...args)
      return { select: () => ({ single: () => Promise.resolve(db.created) }) }
    },
  }))
})

function WeightView() {
  const store = useStore()
  if (store.loading) return <p>loading</p>
  return <>
    <span data-testid="weight">{store.latestWeight?.weight ?? 'empty'}</span>
    <button onClick={() => { void store.upsertWeight({ date: '2026-09-07', weight: 70, bodyFat: 20 }).catch(() => {}) }}>save weight</button>
  </>
}

it('publishes the database-confirmed measurement once', async () => {
  db.created = { data: { id: 'server-id', date: '2026-09-07', weight: 70, body_fat: 20 }, error: null }
  render(<StoreProvider userId="test-user"><WeightView /></StoreProvider>)
  fireEvent.click(await screen.findByText('save weight'))
  await waitFor(() => expect(screen.getByTestId('weight').textContent).toBe('70'))
  expect(db.upsert).toHaveBeenCalledExactlyOnceWith({ user_id: 'test-user', date: '2026-09-07', weight: 70, body_fat: 20 }, { onConflict: 'user_id,date' })
})

it('does not display a measurement rejected by the database', async () => {
  db.created = { data: null, error: { message: 'offline' } }
  render(<StoreProvider userId="test-user"><WeightView /></StoreProvider>)
  fireEvent.click(await screen.findByText('save weight'))
  await waitFor(() => expect(db.upsert).toHaveBeenCalledOnce())
  expect(screen.getByTestId('weight').textContent).toBe('empty')
})
afterEach(cleanup)

describe('StoreProvider hydration', () => {
  it('loads saved targets', async () => {
    mount()
    expect((await screen.findByLabelText('target') as HTMLInputElement).value).toBe('2000')
  })
  it.each(['profiles', 'meals', 'knowledge'])('blocks failed %s reads and retries without reload', async (table) => {
    const original = db.results[table]
    db.results[table] = { data: null, error: { message: 'read failed' } }
    mount()
    await screen.findByText('retry')
    expect(screen.queryByLabelText('target')).toBeNull()
    expect(db.insert).not.toHaveBeenCalled()
    db.results[table] = original
    fireEvent.click(screen.getByText('retry'))
    expect((await screen.findByLabelText('target') as HTMLInputElement).value).toBe('2000')
  })
  it('creates confirmed new profiles with explicit zero targets', async () => {
    db.results.profiles = { data: null, error: null }
    mount()
    expect((await screen.findByLabelText('target') as HTMLInputElement).value).toBe('0')
    expect(db.insert).toHaveBeenCalledWith({ id: 'test-user', target_protein: 0, target_carbs: 0, target_fat: 0, target_calories: 0 })
  })
  it('blocks failed default inserts', async () => {
    db.results.profiles = { data: null, error: null }
    db.created = { data: null, error: { message: 'insert failed' } }
    mount()
    await screen.findByText('retry')
    expect(screen.queryByLabelText('target')).toBeNull()
    db.results.profiles = { data: profile, error: null }
    fireEvent.click(screen.getByText('retry'))
    await screen.findByLabelText('target')
  })
  it('recovers from a thrown transport exception', async () => {
    db.from.mockImplementationOnce(() => { throw new Error('offline') })
    mount()
    await screen.findByText('retry')
    fireEvent.click(screen.getByText('retry'))
    await waitFor(() => expect(screen.queryByLabelText('target')).not.toBeNull())
  })
})
