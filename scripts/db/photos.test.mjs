import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { localDatabase } from './local.mjs'

test('photo meals and favorites save atomically, retry safely and retain the first cover', async () => {
  const db = await localDatabase()
  const user = randomUUID(), other = randomUUID(), mealId = randomUUID()
  const photo = `${user}/first.jpg`
  try {
    await db.query('begin')
    await db.query('insert into auth.users (id) values ($1), ($2)', [user, other])
    await db.query('set local role authenticated')
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: 'authenticated' })])
    const meal = { name: 'Photo rice', date: '2026-09-06', type: 'lunch', amount: 100, unit: 'g', protein: 3, carbs: 28, fat: 1, calories: 130, photoUrl: photo }
    const save = (id, fields, favorite = true) => db.query('select public.record_food_entry($1, $2, $3)', [id, fields, favorite])
    await save(mealId, meal)
    await save(mealId, meal)
    assert.equal((await db.query('select id from meals')).rowCount, 1)
    assert.equal((await db.query('select id from saved_items')).rowCount, 1)
    await save(randomUUID(), { ...meal, photoUrl: `${user}/second.jpg` })
    assert.equal((await db.query('select photo_url from saved_items')).rows[0].photo_url, photo)
    await db.query('delete from meals where id = $1', [mealId])
    assert.equal((await db.query('select photo_url from saved_items')).rows[0].photo_url, photo)
    await db.query('savepoint invalid_photo')
    await assert.rejects(save(randomUUID(), { ...meal, photoUrl: `${other}/private.jpg` }), { code: '42501' })
    await db.query('rollback to savepoint invalid_photo')
    const before = (await db.query('select id from meals')).rowCount
    await db.query('savepoint invalid_meal')
    await assert.rejects(save(randomUUID(), { ...meal, name: 'Bad', calories: -1 }), { code: '22023' })
    await db.query('rollback to savepoint invalid_meal')
    assert.equal((await db.query('select id from meals')).rowCount, before)
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: other, role: 'authenticated' })])
    assert.equal((await db.query('select id from meals')).rowCount, 0)
    assert.equal((await db.query('select id from saved_items')).rowCount, 0)
  } finally { await db.query('rollback'); await db.end() }
})

test('food photo storage is private and isolates reads and uploads by owner', async () => {
  const db = await localDatabase()
  const user = randomUUID(), other = randomUUID()
  try {
    await db.query('begin')
    assert.equal((await db.query("select public from storage.buckets where id = 'food-photos'")).rows[0].public, false)
    await db.query('set local role authenticated')
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: user, role: 'authenticated' })])
    await db.query("insert into storage.objects(bucket_id, name) values ('food-photos', $1)", [`${user}/photo.jpg`])
    assert.equal((await db.query("select name from storage.objects where bucket_id = 'food-photos'")).rowCount, 1)
    await db.query('savepoint foreign_upload')
    await assert.rejects(db.query("insert into storage.objects(bucket_id, name) values ('food-photos', $1)", [`${other}/photo.jpg`]), { code: '42501' })
    await db.query('rollback to savepoint foreign_upload')
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: other, role: 'authenticated' })])
    assert.equal((await db.query("select name from storage.objects where bucket_id = 'food-photos'")).rowCount, 0)
    await db.query('set local role anon')
    assert.equal((await db.query("select name from storage.objects where bucket_id = 'food-photos'")).rowCount, 0)
    await db.query('savepoint anonymous_rpc')
    await assert.rejects(db.query('select public.record_food_entry($1, $2, false)', [randomUUID(), {}]), { code: '42501' })
    await db.query('rollback to savepoint anonymous_rpc')
  } finally { await db.query('rollback'); await db.end() }
})
