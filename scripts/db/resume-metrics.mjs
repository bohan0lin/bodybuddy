import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises'
import os from 'node:os'
import { localDatabase } from './local.mjs'

// Fixed protocol: 100 sequential groups, 10 concurrent connections per group.
// No hosted connection string is accepted. Every fixture belongs to this run.
const startedAt = new Date().toISOString(), owner = randomUUID(), other = randomUUID()
const clients = [], submissions = [], operations = [], checks = []
let admin, failure, cleanupError, active = 0, maxInFlight = 0, environment
const hash = value => createHash('sha256').update(value).digest('hex')
const files = ['scripts/db/resume-metrics.mjs', ...(await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort().map(name => `supabase/migrations/${name}`)]
const versions = Object.fromEntries(await Promise.all(files.map(async path => [path, hash(await readFile(path))])))
const manifest = { protocol: 'idempotency-100x10-v1', startedAt,
  commit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  dirty: Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()), versions,
  logicalOperations: 100, submissionsPerOperation: 10, scheduling: 'Sequential action groups; ten separate PostgreSQL sessions submitted concurrently within each group',
  endpoint: 'transition_coach_proposal via direct authenticated-role SQL; excludes HTTP, model and UI latency',
  node: process.version, platform: os.platform(), cpuCount: os.cpus().length, memoryBytes: os.totalmem(),
  ciRun: process.env.GITHUB_RUN_ID ?? null, ciAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null }
const nutrition = { protein:10, carbs:20, fat:5, calories:165 }
const variants = [
  { type:'log', name:'Synthetic benchmark meal', mealType:'lunch', amount:100, unit:'g', ...nutrition },
  { type:'save', kind:'food', name:'Synthetic benchmark favorite', baseAmount:100, unit:'g', ...nutrition },
  { type:'workout', workoutType:'walk', durationMin:30, calories:100 },
]
const table = { log:'meals', save:'saved_items', workout:'workouts' }
const identify = (client, user) => client.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({ sub:user,role:'authenticated' })])
async function register(action = variants[0]) {
  const id = randomUUID(), user = randomUUID(), assistant = randomUUID()
  const payload = { date:'2026-09-21', action }
  await clients[0].query("select append_coach_message($1,$2,'user',$3)",[owner,user,{ text:'Synthetic benchmark request' }])
  await clients[0].query("select append_coach_message($1,$2,'assistant',$3,$4,$5)",[owner,assistant,{ text:'Synthetic proposal; explicit confirmation required' },user,JSON.stringify([{ actionId:id,...payload }])])
  return { id,payload }
}
async function confirm(client, operation, body = operation.payload, asOwner = owner) {
  return (await client.query("select transition_coach_proposal($1,$2,1,'confirm',$3) as state",[asOwner,operation.id,body])).rows[0].state
}
async function inspect(operation) {
  const { id,payload } = operation, action = payload.action
  const records = (await admin.query(`select * from ${table[action.type]} where user_id=$1 and id=$2`,[owner,id])).rows
  const receipts = (await admin.query('select payload from agent_actions where user_id=$1 and action_id=$2',[owner,id])).rows
  assert.equal(records.length,1); assert.equal(receipts.length,1)
  assert.deepEqual(receipts[0].payload,payload)
  const row = records[0]
  assert.equal(Number(row.calories),action.calories)
  if (action.type === 'workout') {
    assert.equal(row.type,action.workoutType); assert.equal(Number(row.duration_min),action.durationMin)
  } else {
    assert.equal(row.name,action.name); assert.equal(row.unit,action.unit)
    for (const key of ['protein','carbs','fat']) assert.equal(Number(row[key]),action[key])
    if (action.type === 'log') { assert.equal(row.type,action.mealType); assert.equal(Number(row.amount),action.amount) }
    else { assert.equal(row.kind,action.kind); assert.equal(Number(row.base_amount),action.baseAmount) }
  }
  return { records:records.length, receipts:receipts.length, contentCorrect:true }
}
async function probe(name, work) {
  try { await work(); checks.push({ name,pass:true }) }
  catch (error) { checks.push({ name,pass:false,code:error.code ?? 'ASSERTION' }); throw error }
}
try {
  admin = await localDatabase()
  environment = (await admin.query('select version() as postgres, current_database() as database')).rows[0]
  await admin.query('insert into auth.users(id) values($1),($2)',[owner,other])
  for (let i=0;i<10;i++) {
    const client = await localDatabase(); clients.push(client)
    await client.query('set role authenticated'); await identify(client,owner)
  }
  const pids = await Promise.all(clients.map(async client => (await client.query('select pg_backend_pid() as pid')).rows[0].pid))
  assert.equal(new Set(pids).size,10)
  for (let index=0;index<100;index++) {
    const operation = await register(variants[index % variants.length])
    const results = await Promise.all(clients.map(async (client,connection) => {
      const start=performance.now(); active++; maxInFlight=Math.max(maxInFlight,active)
      try {
        const state=await confirm(client,operation)
        assert.equal(state.status,'confirmed'); assert.equal(state.version,2)
        assert.deepEqual(state.payload,operation.payload)
        return { actionId:operation.id,connection,ok:true,latencyMs:performance.now()-start }
      } catch (error) { return { actionId:operation.id,connection,ok:false,code:error.code ?? 'ASSERTION',latencyMs:performance.now()-start } }
      finally { active-- }
    }))
    submissions.push(...results)
    const inspected=await inspect(operation)
    operations.push({ actionId:operation.id,kind:operation.payload.action.type,successfulResponses:results.filter(result=>result.ok).length,...inspected })
    assert.equal(results.filter(result=>result.ok).length,10)
  }
  await probe('same ID with conflicting contents admits only the winning payload',async()=>{
    const operation=await register(), changed={ ...operation.payload,action:{ ...operation.payload.action,calories:999 } }
    const result=await Promise.allSettled(clients.map((client,i)=>confirm(client,operation,i%2?changed:operation.payload)))
    assert.equal(result.filter(row=>row.status==='fulfilled').length,5)
    for (const row of result.filter(row=>row.status==='rejected')) assert.equal(row.reason.code,'PT409')
    const winner=result.find(row=>row.status==='fulfilled').value.payload
    await inspect({ ...operation,payload:winner })
  })
  await probe('discarded post-commit response retries without duplication',async()=>{
    const operation=await register()
    await confirm(clients[0],operation) // Intentionally discard a committed response; no TCP fault is claimed.
    await confirm(clients[1],operation)
    await inspect(operation)
  })
  await probe('business insert failure rolls back receipt and proposal transition',async()=>{
    const operation=await register()
    await admin.query("insert into meals(id,user_id,date,type,name) values($1,$2,'2026-09-21','lunch','Collision fixture')",[operation.id,owner])
    await assert.rejects(confirm(clients[0],operation),{ code:'23505' })
    assert.equal((await admin.query('select * from agent_actions where user_id=$1 and action_id=$2',[owner,operation.id])).rowCount,0)
    assert.equal((await admin.query('select status from coach_proposals where user_id=$1 and action_id=$2',[owner,operation.id])).rows[0].status,'pending')
  })
  await probe('cross-account reads and confirmations are denied',async()=>{
    const operation=await register(); await identify(clients[9],other)
    assert.equal((await clients[9].query('select * from coach_proposals where action_id=$1',[operation.id])).rowCount,0)
    await assert.rejects(confirm(clients[9],operation),{ code:'42501' })
    await assert.rejects(confirm(clients[9],operation,operation.payload,other),{ code:'PT409' })
  })
} catch (error) { failure={ code:error.code ?? 'RUN_FAILED',category:admin?'execution':'local-database-unavailable' } }
finally {
  if (admin) {
    try { await admin.query('delete from auth.users where id=any($1::uuid[])',[[owner,other]]) }
    catch { cleanupError=true }
  }
  await Promise.allSettled([...clients,...(admin?[admin]:[])].map(client=>client.end()))
}
const sorted=submissions.map(row=>row.latencyMs).sort((a,b)=>a-b)
const percentile=q=>sorted.length?sorted[Math.ceil(sorted.length*q)-1]:null
const complete=!failure&&!cleanupError&&operations.length===100&&submissions.length===1000&&checks.length===4&&checks.every(row=>row.pass)
const summary={ status:complete?'pass':'inconclusive', completedLogicalOperations:operations.length,
  submissions:submissions.length, successfulResponses:submissions.filter(row=>row.ok).length,
  errorResponses:submissions.filter(row=>!row.ok).length,
  duplicateRecords:complete?operations.reduce((sum,row)=>sum+Math.max(0,row.records-1),0):null,
  maxInFlight, latencyMs:{ p50:percentile(0.5),p95:percentile(0.95),scope:'All primary submissions, including failed responses; excludes setup, inspection and separate fault probes' } }
const report={ manifest,environment,summary,checks,failure,cleanupError:cleanupError??false,operations,submissions }
const directory='evals/results/concurrency-'+startedAt.replace(/[:.]/g,'-')
await mkdir(directory,{recursive:true})
await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n')
await writeFile(directory+'/report.md',`# Concurrent idempotency experiment\n\nStatus: ${summary.status}. Commit: ${manifest.commit}.\n\n${summary.successfulResponses}/${summary.submissions} successful responses; ${summary.completedLogicalOperations}/100 checked logical operations. Duplicate records: ${summary.duplicateRecords ?? 'not established'}.\n\n${manifest.scheduling}.\n\nMeasurement: ${manifest.endpoint}. Separate fault checks: ${checks.filter(check=>check.pass).length}/4.\n\nThis is one synthetic database run, not HTTP throughput, arbitrary-scale reliability, or real user traffic.\n`)
console.log(JSON.stringify({ directory,summary,checks,failure,cleanupError },null,2))
if (process.env.GITHUB_ACTIONS === 'true') {
  console.log(`::notice title=Concurrency benchmark::${JSON.stringify({ ...summary, faultChecksPassed:checks.filter(check=>check.pass).length, commit:manifest.commit })}`)
}
process.exitCode=complete?0:2
