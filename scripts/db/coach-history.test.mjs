import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// Real PostgreSQL SQL/RLS in memory. Minimal auth/business tables replace Supabase
// services; hosted PostgREST, storage and concurrent connections need integration tests.
const db = new PGlite()
const owner = randomUUID(), other = randomUUID()
const action = { type: 'log', name: 'Rice', mealType: 'lunch', amount: 100, unit: 'g', protein: 3, carbs: 28, fat: 1, calories: 130 }
const payload = { date: '2026-09-21', action }
let migration
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table meals(id uuid primary key,user_id uuid,date date,type text,name text,brand text,amount numeric,unit text,protein numeric,carbs numeric,fat numeric,calories numeric);
    create table saved_items(id uuid primary key,user_id uuid,kind text,name text,brand text,unit text,base_amount numeric,protein numeric,carbs numeric,fat numeric,calories numeric);
    create table workouts(id uuid primary key,user_id uuid,date date,type text,note text,duration_min numeric,calories numeric);
    grant select on meals,saved_items,workouts to authenticated;
  `)
  await db.query('insert into auth.users values($1),($2)', [owner, other])
  await db.exec(await readFile('supabase/migrations/20260909000000_agent_actions.sql', 'utf8'))
  migration = await readFile('supabase/migrations/20260921000000_coach_history.sql', 'utf8')
  await db.exec(migration)
})
beforeEach(async () => {
  await db.exec('reset role; truncate coach_messages,coach_proposals,agent_actions,meals,saved_items,workouts cascade; set role authenticated;')
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner])
})
after(() => db.close())
async function append(id, role, body, reply = null, proposals = []) {
  return db.query('select append_coach_message($1,$2,$3,$4,$5,$6)', [owner,id,role,body,reply,JSON.stringify(proposals)])
}
async function fixture() {
  const user = randomUUID(), assistant = randomUUID(), id = randomUUID()
  await append(user,'user',{ text: 'Log rice' })
  await append(assistant,'assistant',{ text: 'Review this proposal' },user,[{ actionId:id,...payload }])
  return { user, assistant, id }
}
async function transition(id, op, version = 1, body = payload, user = owner) {
  return (await db.query('select transition_coach_proposal($1,$2,$3,$4,$5) as state',[user,id,version,op,body])).rows[0].state
}
test('history and proposals survive a fresh read without inserting business records', async () => {
  await fixture()
  assert.equal((await db.query('select * from coach_messages order by sequence')).rows.length,2)
  assert.equal((await db.query('select * from coach_proposals')).rows[0].status,'pending')
  assert.equal((await db.query('select * from meals')).rows.length,0)
})
test('confirmation and an identical retry leave one record and a terminal state', async () => {
  const { id } = await fixture()
  const result = await transition(id,'confirm')
  assert.equal(result.status,'confirmed')
  assert.deepEqual(await transition(id,'confirm'),result)
  assert.equal((await db.query('select * from meals')).rows.length,1)
  await assert.rejects(transition(id,'cancel',result.version),{ code:'PT409' })
})
test('cancel is durable, idempotent and cannot be bypassed through the legacy RPC', async () => {
  const { id } = await fixture()
  assert.equal((await transition(id,'cancel')).status,'cancelled')
  assert.equal((await transition(id,'cancel')).status,'cancelled')
  await assert.rejects(transition(id,'confirm'),{ code:'PT409' })
  await assert.rejects(db.query('select confirm_agent_action($1,$2)',[id,payload]),{ code:'PT409' })
  await assert.rejects(db.query('select execute_agent_action($1,$2)',[id,payload]),{ code:'42501' })
  assert.equal((await db.query('select * from meals')).rows.length,0)
})
test('saved edits invalidate stale confirmation and support an identical edit retry', async () => {
  const { id } = await fixture()
  const edited = { ...payload, action:{ ...action, calories:150 } }
  const result = await transition(id,'edit',1,edited)
  assert.equal(result.version,2)
  assert.deepEqual(await transition(id,'edit',1,edited),result)
  await assert.rejects(transition(id,'confirm',1,payload),{ code:'PT409' })
  assert.equal((await transition(id,'confirm',2,edited)).status,'confirmed')
  assert.equal(Number((await db.query('select calories from meals')).rows[0].calories),150)
  await assert.rejects(transition(id,'confirm',2,payload),{ code:'PT409' })
})
test('invalid confirmation rolls back both receipt and proposal transition', async () => {
  const { id } = await fixture()
  await assert.rejects(transition(id,'confirm',1,{ ...payload,action:{ ...action,calories:-1 } }),{ code:'22023' })
  assert.equal((await db.query('select * from agent_actions')).rows.length,0)
  assert.equal((await db.query('select status from coach_proposals')).rows[0].status,'pending')
})
test('another account cannot read, append as, or transition the owner history', async () => {
  const { id } = await fixture()
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other])
  assert.equal((await db.query('select * from coach_messages')).rows.length,0)
  assert.equal((await db.query('select * from coach_proposals')).rows.length,0)
  await assert.rejects(append(randomUUID(),'user',{ text:'forged' }),{ code:'42501' })
  await assert.rejects(transition(id,'confirm'),{ code:'42501' })
  await assert.rejects(transition(id,'confirm',1,payload,other),{ code:'PT409' })
})
test('direct mutation and anonymous access are denied', async () => {
  await fixture()
  await assert.rejects(db.exec("update coach_proposals set status='pending'"),{ code:'42501' })
  await assert.rejects(db.exec('delete from coach_messages'),{ code:'42501' })
  await db.exec('reset role; set role anon;')
  await assert.rejects(db.exec('select * from coach_messages'),{ code:'42501' })
  await assert.rejects(append(randomUUID(),'user',{ text:'anonymous' }),{ code:'42501' })
})
test('expired proposals cannot be edited or confirmed', async () => {
  const { id } = await fixture()
  await db.exec("reset role; update coach_proposals set expires_at=now()-interval '1 second'; set role authenticated;")
  await assert.rejects(transition(id,'confirm'),{ code:'PT410' })
  await assert.rejects(transition(id,'edit'),{ code:'PT410' })
})
test('message retries preserve terminal proposals and reject content replacement', async () => {
  const { user,assistant,id } = await fixture()
  await transition(id,'cancel')
  await append(assistant,'assistant',{ text:'Review this proposal' },user,[{ actionId:id,...payload }])
  assert.equal((await db.query('select status from coach_proposals')).rows[0].status,'cancelled')
  await assert.rejects(append(user,'user',{ text:'changed' }),{ code:'PT409' })
  await assert.rejects(append(randomUUID(),'assistant',{ text:'second reply' },user),{ code:'23505' })
})
test('replaying the migration preserves state and legacy clients can still confirm new actions', async () => {
  const { id } = await fixture()
  await transition(id,'cancel')
  await db.exec('reset role;')
  await db.exec(await readFile('supabase/migrations/20260909000000_agent_actions.sql', 'utf8'))
  await db.exec(migration)
  await db.exec('set role authenticated;')
  assert.equal((await db.query('select status from coach_proposals')).rows[0].status,'cancelled')
  await assert.rejects(db.query('select confirm_agent_action($1,$2)',[id,payload]),{ code:'PT409' })
  await db.query('select confirm_agent_action($1,$2)',[randomUUID(),payload])
  assert.equal((await db.query('select * from meals')).rows.length,1)
})

test('account deletion removes its messages and proposal state', async () => {
  await fixture()
  await db.exec('reset role;')
  await db.query('delete from auth.users where id=$1',[owner])
  assert.equal((await db.query('select * from coach_messages')).rows.length,0)
  assert.equal((await db.query('select * from coach_proposals')).rows.length,0)
})
