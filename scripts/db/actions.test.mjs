import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { localDatabase } from './local.mjs'

const nutrition = { protein: 10, carbs: 20, fat: 5, calories: 165 }
const actions = {
  log: { type: 'log', name: 'Synthetic meal', mealType: 'lunch', amount: 100, unit: 'g', ...nutrition },
  save: { type: 'save', kind: 'food', name: 'Synthetic favorite', baseAmount: 100, unit: 'g', ...nutrition },
  workout: { type: 'workout', workoutType: 'walk', durationMin: 30, calories: 100 },
}
const tables = { log: 'meals', save: 'saved_items', workout: 'workouts' }
const payload = action => ({ date: '2026-09-09', action })
async function fixture(run) {
  const db = await localDatabase(), user = randomUUID(), other = randomUUID()
  try {
    await db.query('begin')
    await db.query('insert into auth.users(id) values ($1),($2)', [user, other])
    await db.query('set local role authenticated')
    const identify = id => db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, role: 'authenticated' })])
    await identify(user)
    const save = async (id, action) => (await db.query('select public.confirm_agent_action($1,$2) as receipt', [id, payload(action)])).rows[0].receipt
    await run({ db, user, other, identify, save })
  } finally { await db.query('rollback'); await db.end() }
}
for (const kind of Object.keys(actions)) {
  test(`${kind}: exact retry returns one immutable receipt and one record`, () => fixture(async ({ db, save }) => {
    const id = randomUUID()
    assert.deepEqual(await save(id, actions[kind]), { recordId: id, replayed: false })
    assert.deepEqual(await save(id, actions[kind]), { recordId: id, replayed: true })
    assert.equal((await db.query(`select id from ${tables[kind]}`)).rowCount, 1)
    assert.equal((await db.query('select action_id from agent_actions')).rowCount, 1)
  }))
  test(`${kind}: changed content conflicts without overwriting`, () => fixture(async ({ db, save }) => {
    const id = randomUUID()
    await save(id, actions[kind])
    await db.query('savepoint conflict')
    await assert.rejects(save(id, { ...actions[kind], calories: 999 }), { code: 'PT409' })
    await db.query('rollback to savepoint conflict')
    assert.equal(Number((await db.query(`select calories from ${tables[kind]} where id=$1`, [id])).rows[0].calories), actions[kind].calories)
  }))
}
test('receipt cannot be inserted or changed directly by an authenticated client', () => fixture(async ({ db, user, save }) => {
  await save(randomUUID(), actions.log)
  for (const sql of ["update agent_actions set payload='{}'", 'delete from agent_actions', `insert into agent_actions(user_id,action_id,payload,record_id) values ('${user}',gen_random_uuid(),'{}',gen_random_uuid())`]) {
    await db.query('savepoint forbidden')
    await assert.rejects(db.query(sql), { code: '42501' })
    await db.query('rollback to savepoint forbidden')
  }
}))
test('receipts and records are isolated between accounts', () => fixture(async ({ db, other, identify, save }) => {
  await save(randomUUID(), actions.log)
  await identify(other)
  assert.equal((await db.query('select * from agent_actions')).rowCount, 0)
  assert.equal((await db.query('select * from meals')).rowCount, 0)
}))
test('anonymous calls cannot create records', () => fixture(async ({ db, save }) => {
  await db.query('set local role anon')
  await assert.rejects(save(randomUUID(), actions.log), { code: '42501' })
}))
test('invalid proposals roll back their receipt', () => fixture(async ({ db, save }) => {
  for (const invalid of [{ ...actions.log, calories: -1 }, { ...actions.save, baseAmount: 0 }, { ...actions.workout, durationMin: 0 }, { ...actions.log, user_id: randomUUID() }]) {
    await db.query('savepoint invalid')
    await assert.rejects(save(randomUUID(), invalid), { code: '22023' })
    await db.query('rollback to savepoint invalid')
  }
  assert.equal((await db.query('select * from agent_actions')).rowCount, 0)
}))
test('retry after record deletion does not resurrect it', () => fixture(async ({ db, save }) => {
  const id = randomUUID()
  await save(id, actions.log)
  await db.query('delete from meals where id=$1', [id])
  assert.equal((await save(id, actions.log)).replayed, true)
  assert.equal((await db.query('select * from meals')).rowCount, 0)
}))
test('record constraint failure leaves no action receipt', () => fixture(async ({ db, user, save }) => {
  const id = randomUUID()
  await db.query("insert into meals(id,user_id,date,type,name) values ($1,$2,'2026-09-09','lunch','Existing')", [id, user])
  await db.query('savepoint collision')
  await assert.rejects(save(id, actions.log), { code: '23505' })
  await db.query('rollback to savepoint collision')
  assert.equal((await db.query('select * from agent_actions')).rowCount, 0)
}))
test('date changes are content conflicts', () => fixture(async ({ db, save }) => {
  const id = randomUUID()
  await save(id, actions.log)
  await assert.rejects(db.query('select confirm_agent_action($1,$2)', [id, { ...payload(actions.log), date: '2026-09-08' }]), { code: 'PT409' })
}))
for (const conflict of [false, true]) {
  test(`concurrent ${conflict ? 'conflicting' : 'identical'} confirmations serialize at the unique constraint`, async () => {
    const setup = await localDatabase(), first = await localDatabase(), second = await localDatabase()
    const user = randomUUID(), id = randomUUID()
    try {
      await setup.query('insert into auth.users(id) values($1)', [user])
      for (const db of [first, second]) {
        await db.query('set role authenticated')
        await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: user, role: 'authenticated' })])
      }
      const results = await Promise.allSettled([first, second].map((db, i) => db.query('select confirm_agent_action($1,$2)', [id, payload({ ...actions.log, calories: conflict && i ? 999 : 165 })])))
      assert.equal(results.filter(result => result.status === 'fulfilled').length, conflict ? 1 : 2)
      if (conflict) assert.equal(results.find(result => result.status === 'rejected').reason.code, 'PT409')
      assert.equal((await setup.query('select id from meals where user_id=$1', [user])).rowCount, 1)
    } finally {
      await setup.query('delete from auth.users where id=$1', [user])
      await Promise.all([setup.end(), first.end(), second.end()])
    }
  })
}
