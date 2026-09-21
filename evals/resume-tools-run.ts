import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { google } from '@ai-sdk/google'
import { assistantChat } from '../api/_lib/assistant'
import { assistantContext } from './cases'
import { resumeToolCases, RESUME_TOOLS_VERSION } from './resume-tools'
import { assertFrozen, isolateEvaluationEnv } from './harness'
import { estimateCost, scoreActions, SCORER_VERSION } from './scoring'
import { failureDetail } from './failure'
import { loadProviderKeys } from './provider-env.mjs'

const live = process.argv.includes('--live')
if (process.argv.slice(2).some(arg=>!['--live','--dry-run'].includes(arg))) throw new Error('Use --live or --dry-run')
if (live && process.argv.includes('--dry-run')) throw new Error('Choose one run mode')
assertFrozen(resumeToolCases,JSON.parse(await readFile('evals/resume-tools.lock.json','utf8')),RESUME_TOOLS_VERSION)
if (live) loadProviderKeys('.env.local')
delete process.env.EVAL_SUPABASE_URL; delete process.env.EVAL_SUPABASE_ANON_KEY
isolateEvaluationEnv(process.env)
const configs = JSON.parse(await readFile('evals/models.google.json','utf8'))
const config = configs.find((item: {id:string})=>item.id==='google-lite')
if (!config?.pricing || config.provider!=='google') throw new Error('Verified Google Lite configuration required')
if (live && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error('Google provider key unavailable')
const maxUsd=0.5, repetitions=3, startedAt=new Date().toISOString()
const sources=['evals/resume-tools.ts','evals/resume-tools.lock.json','evals/resume-tools-run.ts','evals/scoring.ts','evals/cases.ts','api/_lib/assistant.ts','api/_lib/contracts.ts','api/_lib/model-request.ts']
const versions=Object.fromEntries(await Promise.all(sources.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])))
type Result = { id:string; repetition:number; attempted:boolean; status:'pass'|'fail'|'inconclusive'; reason?:string; latencyMs?:number; estimatedUsd?:number; inputTokens?:number; outputTokens?:number; toolCorrect?:boolean; argumentsCorrect?:boolean; output?:unknown }
const rows:Result[]=[], maxCases=resumeToolCases.length*repetitions
let spent=0, unknownCost=false
for (let repetition=1;repetition<=repetitions;repetition++) for (const c of resumeToolCases) {
  const row:Result={ id:c.id,repetition,attempted:false,status:'inconclusive' }
  rows.push(row)
  if (!live) { row.reason='Dry run; no calls'; continue }
  if (unknownCost || spent>=maxUsd) { row.reason=unknownCost?'Stopped after unknown-cost request':'Observed-spend allowance reached'; continue }
  const start=performance.now(); row.attempted=true
  try {
    const output=await assistantChat({ messages:[{role:'user',text:c.text}],context:assistantContext,date:'2026-09-21',lang:c.lang,
      model:google(config.model),lookup:async()=>null,
      onUsage(usage) { row.inputTokens=usage.inputTokens; row.outputTokens=usage.outputTokens; row.estimatedUsd=estimateCost(usage.inputTokens,usage.outputTokens,config.pricing) },
    },AbortSignal.timeout(60000))
    const score=scoreActions(output.actions,c.expected)
    Object.assign(row,{ status:score.pass?'pass':'fail',toolCorrect:score.toolCorrect,argumentsCorrect:score.argumentsCorrect,output })
  } catch(error) { row.reason=failureDetail(error) }
  row.latencyMs=performance.now()-start
  if (row.estimatedUsd===undefined) unknownCost=true
  else spent+=row.estimatedUsd
  console.log(`${c.id}/repeat-${repetition}: ${row.status}`)
}
const scored=rows.filter(row=>row.status!=='inconclusive'), passed=scored.filter(row=>row.status==='pass').length
const attempted=rows.filter(row=>row.attempted), latency=attempted.map(row=>row.latencyMs!).sort((a,b)=>a-b)
const percentile=(q:number)=>latency.length?latency[Math.ceil(latency.length*q)-1]:null
const complete=live&&scored.length===maxCases
const summary={ status:complete?(passed===maxCases?'pass':'fail'):'inconclusive',distinctScenarios:resumeToolCases.length,repetitions,plannedRuns:maxCases,
  attempted:attempted.length,scored:scored.length,passed,failed:scored.length-passed,unscored:maxCases-scored.length,
  toolCorrect:scored.filter(row=>row.toolCorrect).length,argumentsCorrect:scored.filter(row=>row.argumentsCorrect).length,
  casePassRate:scored.length?passed/scored.length:null,complete,knownEstimatedUsd:spent,costComplete:live&&!unknownCost,
  estimatedUsdPerSuccessfulTask:live&&!unknownCost&&passed?spent/passed:null,
  latencyMs:{ p50:percentile(0.5),p95:percentile(0.95),sample:attempted.length,includesFailures:true } }
const report={ manifest:{ protocol:RESUME_TOOLS_VERSION,startedAt,mode:live?'live':'dry-run',config,maxUsd,maxCases,repetitions,scorer:SCORER_VERSION,versions,
  commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),
  retrieval:'none; injected lookup always returns null',scheduling:'Sequential, fixed case order, three complete passes planned; no automatic retry',
  costBoundary:'Reported generation tokens at verified standard paid-tier prices; no embedding calls. Unknown usage stops execution. Last bounded request may exceed observed-spend allowance.',
  latencyBoundary:'Complete assistant tool loop, including failed/timeout attempts; excludes HTTP/browser/database. No warm-up; provider caching not controlled.',
},summary,rows }
const directory='evals/results/resume-tools-'+startedAt.replace(/[:.]/g,'-')
await mkdir(directory,{recursive:true}); await writeFile(directory+'/report.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({ directory,summary },null,2))
if (live) process.exitCode=complete?(passed===maxCases?0:1):2
