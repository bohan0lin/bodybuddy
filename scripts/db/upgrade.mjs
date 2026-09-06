import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { localDatabase } from './local.mjs'

const db = await localDatabase()
try {
  await db.query('begin')
  await db.query(await readFile('supabase/tests/fixtures/previous.sql', 'utf8'))
  const oldUser = '30000000-0000-4000-8000-000000000001'
  const newUser = '30000000-0000-4000-8000-000000000002'
  await db.query('insert into auth.users (id) values ($1)', [oldUser])
  await db.query('update profiles set target_calories=2345, target_protein=123, target_carbs=234, target_fat=67 where id=$1', [oldUser])
  await db.query("insert into meals (user_id,date,type,name,calories) values ($1,'2026-09-06','lunch','Synthetic legacy meal',456)", [oldUser])
  await db.query("insert into saved_items (user_id,kind,name) values ($1,'food','Synthetic legacy food')", [oldUser])
  const select = 'select target_calories,target_protein,target_carbs,target_fat,height_cm from profiles where id=$1'
  const before = (await db.query(select, [oldUser])).rows[0]
  for (const file of (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort()) {
    await db.query(await readFile('supabase/migrations/' + file, 'utf8'))
  }
  assert.deepEqual((await db.query(select, [oldUser])).rows[0], before)
  assert.equal((await db.query('select goal_type from profiles where id=$1', [oldUser])).rows[0].goal_type, null)
  assert.equal((await db.query('select brand from meals where user_id=$1', [oldUser])).rows[0].brand, null)
  assert.equal(Number((await db.query('select calories from meals where user_id=$1', [oldUser])).rows[0].calories), 456)
  assert.equal((await db.query('select brand from saved_items where user_id=$1', [oldUser])).rows[0].brand, null)
  await db.query('insert into auth.users (id) values ($1)', [newUser])
  for (const value of Object.values((await db.query(select, [newUser])).rows[0])) assert.equal(Number(value), 0)
  console.log('Legacy fixture upgrade passed: targets and records preserved; new defaults are zero.')
} finally {
  await db.query('rollback')
  await db.end()
}
