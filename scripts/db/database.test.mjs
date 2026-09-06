import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { localDatabase } from './local.mjs'

const A = '10000000-0000-4000-8000-000000000001'
const B = '10000000-0000-4000-8000-000000000002'
const ONE = '20000000-0000-4000-8000-000000000001'
const TWO = '20000000-0000-4000-8000-000000000002'
const THREE = '20000000-0000-4000-8000-000000000003'
const cases = [
  { table: 'meals', fields: { date: '2026-09-06', type: 'lunch', name: 'Synthetic meal', protein: 20, calories: 300 }, field: 'name', updated: 'Updated meal' },
  { table: 'weight_logs', fields: { date: '2026-09-06', weight: 70 }, field: 'weight', updated: '71' },
  { table: 'workouts', fields: { date: '2026-09-06', type: 'walk', duration_min: 20, calories: 80 }, field: 'note', updated: 'Updated workout' },
  { table: 'saved_items', fields: { kind: 'food', name: 'Synthetic food' }, field: 'name', updated: 'Updated saved food' },
  { table: 'knowledge', fields: { title: 'Synthetic note', content: 'Test-only content' }, field: 'content', updated: 'Updated note' },
]
async function insert(db, table, row) {
  const keys = Object.keys(row)
  return db.query(`insert into public.${table} (${keys.join(',')}) values (${keys.map((_, i) => '$' + (i + 1)).join(',')}) returning *`, Object.values(row))
}
async function errorCode(db, sql, params, expected) {
  await db.query('savepoint expected_error')
  let caught
  try { await db.query(sql, params) } catch (error) { caught = error.code }
  await db.query('rollback to savepoint expected_error')
  await db.query('release savepoint expected_error')
  assert.equal(caught, expected)
}
async function asUser(db, id) {
  await db.query('set local role authenticated')
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, role: 'authenticated' })])
}
async function transaction(run) {
  const db = await localDatabase()
  try {
    await db.query('begin')
    await db.query('insert into auth.users (id) values ($1), ($2)', [A, B])
    await run(db)
  } finally {
    await db.query('rollback')
    await db.end()
  }
}

test('new auth users receive zero targets and a nullable goal', () => transaction(async (db) => {
  const { rows: [profile] } = await db.query('select * from public.profiles where id = $1', [A])
  for (const field of ['height_cm', 'target_protein', 'target_carbs', 'target_fat', 'target_calories']) assert.equal(Number(profile[field]), 0)
  assert.equal(profile.goal_type, null)
}))

test('profile CRUD, ownership and numeric-only / goal persistence', () => transaction(async (db) => {
  await asUser(db, A)
  assert.equal((await db.query('select id from profiles')).rowCount, 1)
  assert.equal((await db.query('select id from profiles where id = $1', [B])).rowCount, 0)
  assert.equal((await db.query("update profiles set display_name = 'attack' where id = $1 returning id", [B])).rowCount, 0)
  assert.equal((await db.query('delete from profiles where id = $1 returning id', [B])).rowCount, 0)
  await errorCode(db, 'update profiles set id = $1 where id = $2', [B, A], '42501')
  await db.query('update profiles set target_calories = 2100, target_protein = 120 where id = $1', [A])
  assert.equal(Number((await db.query('select target_calories from profiles where id = $1', [A])).rows[0].target_calories), 2100)
  for (const goal of ['recomposition', 'fat_loss', 'muscle_gain', 'maintenance', 'performance', null]) {
    await db.query('update profiles set goal_type = $1 where id = $2', [goal, A])
    const { rows: [row] } = await db.query('select goal_type, target_calories, target_protein from profiles where id = $1', [A])
    assert.equal(row.goal_type, goal)
    assert.equal(Number(row.target_calories), 2100)
    assert.equal(Number(row.target_protein), 120)
  }
  await errorCode(db, "update profiles set goal_type = 'invalid' where id = $1", [A], '23514')
  await db.query('delete from profiles where id = $1', [A])
  assert.equal((await insert(db, 'profiles', { id: A })).rowCount, 1)
  await errorCode(db, 'insert into profiles (id) values ($1)', [B], '42501')
}))

for (const item of cases) {
  test(`${item.table}: authenticated CRUD and cross-user read/write/delete isolation`, () => transaction(async (db) => {
    await insert(db, item.table, { id: ONE, user_id: A, ...item.fields })
    await insert(db, item.table, { id: TWO, user_id: B, ...item.fields })
    await asUser(db, A)
    assert.deepEqual((await db.query(`select id from ${item.table}`)).rows.map((row) => row.id), [ONE])
    assert.equal((await db.query(`select id from ${item.table} where id = $1`, [TWO])).rowCount, 0)
    assert.equal((await db.query(`update ${item.table} set ${item.field} = $1 where id = $2 returning id`, [item.updated, TWO])).rowCount, 0)
    assert.equal((await db.query(`delete from ${item.table} where id = $1 returning id`, [TWO])).rowCount, 0)
    await errorCode(db, `update ${item.table} set user_id = $1 where id = $2`, [B, ONE], '42501')
    await db.query('savepoint foreign_insert')
    let forbidden
    try { await insert(db, item.table, { id: THREE, user_id: B, ...item.fields }) } catch (error) { forbidden = error.code }
    await db.query('rollback to savepoint foreign_insert')
    assert.equal(forbidden, '42501')
    assert.equal((await db.query(`update ${item.table} set ${item.field} = $1 where id = $2 returning *`, [item.updated, ONE])).rows[0][item.field], item.updated)
    assert.equal((await db.query(`delete from ${item.table} where id = $1 returning id`, [ONE])).rowCount, 1)
    assert.equal((await insert(db, item.table, { id: THREE, user_id: A, ...item.fields })).rowCount, 1)
    await asUser(db, B)
    assert.deepEqual((await db.query(`select id from ${item.table}`)).rows.map((row) => row.id), [TWO])
  }))
}

test('anonymous cannot access private tables; shared foods are read-only', () => transaction(async (db) => {
  await insert(db, 'foods', { id: ONE, name: 'Synthetic reference', protein: 1, carbs: 2, fat: 3, calories: 39 })
  await db.query('set local role anon')
  for (const table of ['profiles', ...cases.map((item) => item.table)]) await errorCode(db, `select * from ${table}`, [], '42501')
  assert.equal((await db.query('select id from foods where id = $1', [ONE])).rowCount, 1)
  for (const role of ['anon', 'authenticated']) {
    await db.query(`set local role ${role}`)
    await errorCode(db, "update foods set name = 'tampered' where id = $1", [ONE], '42501')
  }
}))

test('foreign keys, unique keys and cascade deletion', () => transaction(async (db) => {
  await errorCode(db, 'insert into weight_logs (user_id,date,weight) values ($1,$2,70)', [THREE, '2026-09-06'], '23503')
  for (const item of cases) await insert(db, item.table, { id: ONE, user_id: A, ...item.fields })
  await errorCode(db, 'insert into weight_logs (user_id,date,weight) values ($1,$2,71)', [A, '2026-09-06'], '23505')
  await errorCode(db, 'insert into knowledge (user_id,title,content) values ($1,$2,$3)', [A, 'Synthetic note', 'duplicate'], '23505')
  await db.query('delete from auth.users where id = $1', [A])
  for (const table of ['profiles', ...cases.map((item) => item.table)]) {
    assert.equal((await db.query(`select id from ${table} where ${table === 'profiles' ? 'id' : 'user_id'} = $1`, [A])).rowCount, 0)
  }
}))

test('all current migrations replay without changing existing targets or records', () => transaction(async (db) => {
  await db.query('update profiles set target_calories=2100, target_protein=120, target_carbs=240, target_fat=70 where id=$1', [A])
  for (const item of cases) await insert(db, item.table, { id: ONE, user_id: A, ...item.fields })
  const before = (await db.query('select to_jsonb(p) as profile from profiles p where id=$1', [A])).rows[0]
  for (const file of (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()) await db.query(await readFile('supabase/migrations/' + file, 'utf8'))
  assert.deepEqual((await db.query('select to_jsonb(p) as profile from profiles p where id=$1', [A])).rows[0], before)
  for (const item of cases) assert.equal((await db.query(`select id from ${item.table} where id=$1`, [ONE])).rowCount, 1)
}))
