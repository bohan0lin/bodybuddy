import { supabase } from './supabase'
import type { DatabaseInsert, DatabaseRow } from './database'

export class RecordConflict extends Error {}

export async function withRecordTimeout<T>(work: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try { return await work(controller.signal) }
  finally { clearTimeout(timer) }
}

type Result<T> = { data: T | null; error: { code: string } | null }
async function verifyInsert<T extends Record<string, unknown>>(row: Record<string, unknown>, inserted: Result<T>, read: () => PromiseLike<Result<T>>): Promise<T> {
  if (!inserted.error && inserted.data) return inserted.data
  if (inserted.error?.code !== '23505') throw new Error('Record save failed')
  const existing = await read()
  if (existing.error || !existing.data) throw new Error('Record verification failed')
  const values = existing.data as Record<string, unknown>
  if (!Object.entries(row).every(([key, value]) => values[key] === value)) {
    throw new RecordConflict('This record already exists with different content')
  }
  return existing.data
}

// A retry may read an existing row, but must never overwrite different content.
export function insertRecord(table: 'meals', row: DatabaseInsert<'meals'> & { id: string }, signal: AbortSignal): Promise<DatabaseRow<'meals'>>
export function insertRecord(table: 'workouts', row: DatabaseInsert<'workouts'> & { id: string }, signal: AbortSignal): Promise<DatabaseRow<'workouts'>>
export function insertRecord(table: 'knowledge', row: DatabaseInsert<'knowledge'> & { id: string }, signal: AbortSignal): Promise<DatabaseRow<'knowledge'>>
export async function insertRecord(...[table, row, signal]: ['meals', DatabaseInsert<'meals'> & { id: string }, AbortSignal] | ['workouts', DatabaseInsert<'workouts'> & { id: string }, AbortSignal] | ['knowledge', DatabaseInsert<'knowledge'> & { id: string }, AbortSignal]) {
  if (table === 'meals') {
    return verifyInsert(row, await supabase.from('meals').insert(row).select('*').abortSignal(signal).single(),
      () => supabase.from('meals').select('*').eq('id', row.id).eq('user_id', row.user_id).abortSignal(signal).single())
  }
  if (table === 'knowledge') {
    return verifyInsert(row, await supabase.from('knowledge').insert(row).select('*').abortSignal(signal).single(),
      () => supabase.from('knowledge').select('*').eq('id', row.id).eq('user_id', row.user_id).abortSignal(signal).single())
  }
  return verifyInsert(row, await supabase.from('workouts').insert(row).select('*').abortSignal(signal).single(),
    () => supabase.from('workouts').select('*').eq('id', row.id).eq('user_id', row.user_id).abortSignal(signal).single())
}
