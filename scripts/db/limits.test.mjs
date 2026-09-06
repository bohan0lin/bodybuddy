import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import pg from 'pg'
import { localDatabase } from './local.mjs'

const reserve = async (db, id, ip, endpoint = 'lookup', image = false) => (await db.query('select public.reserve_ai_request($1,$2,$3,$4) as result', [id, ip, endpoint, image])).rows[0].result
async function transaction(run) {
  const db = await localDatabase()
  try { await db.query('begin'); await run(db, randomUUID(), randomBytes(32).toString('hex')) }
  finally { await db.query('rollback'); await db.end() }
}

test('regular users cannot invoke or tamper with the reservation mechanism', () => transaction(async (db, id, ip) => {
  for (const role of ['anon', 'authenticated']) {
    await db.query(`set local role ${role}`)
    for (const sql of ["select public.reserve_ai_request($1,$2,'lookup',false)", 'select * from private.ai_request_limits where bucket_key=$1 or bucket_key=$2']) {
      await db.query('savepoint denied')
      await assert.rejects(db.query(sql, [id, ip]), { code: '42501' })
      await db.query('rollback to savepoint denied')
    }
    await db.query('reset role')
  }
  await db.query('set local role service_role')
  assert.equal((await reserve(db, id, ip)).allowed, true)
}))

test('image limits cover both recognition and assistant photos', () => transaction(async (db, id, ip) => {
  // Avoid straddling the minute window while asserting the burst count.
  const { rows: [{ seconds }] } = await db.query('select 60 - mod(floor(extract(epoch from clock_timestamp()))::int,60) as seconds')
  if (seconds < 3) await new Promise((resolve) => setTimeout(resolve, (seconds + 0.1) * 1000))
  for (let i = 0; i < 3; i++) assert.equal((await reserve(db, id, ip, 'assistant', true)).allowed, true)
  const denied = await reserve(db, id, ip, 'recognize')
  assert.equal(denied.allowed, false)
  assert.ok(denied.retryAfter > 0)
  assert.equal((await reserve(db, id, ip, 'lookup')).allowed, true)
}))

test('IP limits span users and denied calls consume no daily quota', () => transaction(async (db, id, ip) => {
  await db.query("insert into private.ai_request_limits values ($1,(floor(extract(epoch from clock_timestamp()))::bigint/60)*60,60,(floor(extract(epoch from clock_timestamp()))::bigint/60)*60+60)", ['ip-minute:' + ip])
  assert.equal((await reserve(db, id, ip)).allowed, false)
  assert.equal((await db.query('select used from private.ai_request_limits where bucket_key=$1', ['user-day:' + id])).rowCount, 0)
}))

test('expired buckets renew without discarding the current daily budget', () => transaction(async (db, id, ip) => {
  await db.query("insert into private.ai_request_limits values ($1,0,10,60)", ['user-minute:' + id])
  assert.equal((await reserve(db, id, ip, 'assistant')).allowed, true)
  const { rows: [day] } = await db.query('select used from private.ai_request_limits where bucket_key=$1', ['user-day:' + id])
  assert.equal(day.used, 4)
}))

test('concurrent reservations cannot exceed the daily budget', async () => {
  const db = await localDatabase()
  const id = randomUUID()
  const ip = randomBytes(32).toString('hex')
  try {
    await db.query("insert into private.ai_request_limits values ($1,(floor(extract(epoch from clock_timestamp()))::bigint/86400)*86400,99,(floor(extract(epoch from clock_timestamp()))::bigint/86400)*86400+86400)", ['user-day:' + id])
    const results = await Promise.all(Array.from({ length: 16 }, async () => {
      const connection = new pg.Client({ host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres', database: 'postgres', statement_timeout: 10000 })
      try { await connection.connect(); return await reserve(connection, id, ip) }
      finally { await connection.end() }
    }))
    assert.equal(results.filter((result) => result.allowed).length, 1)
    assert.equal((await db.query('select used from private.ai_request_limits where bucket_key=$1', ['user-day:' + id])).rows[0].used, 100)
  } finally {
    await db.query('delete from private.ai_request_limits where bucket_key = any($1::text[])', [[`user-day:${id}`, `user-minute:${id}`, `ip-minute:${ip}`]])
    await db.end()
  }
})
