import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { assistantChat } from '../api/_lib/assistant'
import { lookupFoods } from '../api/_lib/rag'
import { RETRIEVAL_VERSION } from '../api/_lib/retrieval'
import { assistantContext } from './cases'
import { DATASET_VERSION, retrievalCases, toolCases } from './dataset'
import { SCORER_VERSION, estimateCost, scoreActions, scoreRetrieval, summarize, type Row } from './scoring'

// Live runs are opt-in. This runner never loads production .env.local credentials.
const args = process.argv.slice(2)
const flags = new Set(['--live','--dry-run'])
const values = new Set(['--config','--suite','--max-cases','--max-usd'])
const options: Record<string,string> = {}
for (let i = 0; i < args.length; i++) {
  if (flags.has(args[i])) options[args[i]] = 'true'
  else if (values.has(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i]] = args[++i]
  else throw new Error(`Unknown or missing option: ${args[i]}`)
}
const suite = z.enum(['all','tools','retrieval']).parse(options['--suite'] ?? 'all')
const maxCases = z.coerce.number().int().min(1).max(100).parse(options['--max-cases'] ?? 12)
const maxUsd = z.coerce.number().positive().max(20).parse(options['--max-usd'] ?? 0.5)
const modelSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), provider: z.enum(['google','openai','anthropic']), model: z.string().min(1),
  pricing: z.object({ inputPerMillion: z.number().nonnegative(), outputPerMillion: z.number().nonnegative(), verifiedOn: z.iso.date() }).nullable() }).strict()
const configs = z.array(modelSchema).min(1).max(3).parse(JSON.parse(await readFile(options['--config'] ?? 'evals/models.example.json', 'utf8')))
if (new Set(configs.map(c => c.id)).size !== configs.length) throw new Error('Model configuration IDs must be unique')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const versions = Object.fromEntries(await Promise.all(['api/_lib/assistant.ts','api/_lib/contracts.ts','api/_lib/retrieval.ts','scripts/foods.json','evals/dataset.ts','evals/scoring.ts'].map(async file => [file, hash(await readFile(file,'utf8'))])))
const manifest = { dataset: DATASET_VERSION, scorer: SCORER_VERSION, retrieval: RETRIEVAL_VERSION, versions,
  commit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), dirty: Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),
  configs, suite, maxCases, maxUsd, startedAt: new Date().toISOString(), mode: options['--live'] && !options['--dry-run'] ? 'live' : 'dry-run' }
const rows: Row[] = []
let calls = 0, spent = 0, unknownSpend = false
const keyNames = { google: 'GOOGLE_GENERATIVE_AI_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' }
const providers = { google, openai, anthropic }
if (manifest.mode === 'live') {
  if (suite !== 'tools') {
    // Only the explicitly named evaluation database may be queried.
    process.env.SUPABASE_URL = process.env.EVAL_SUPABASE_URL ?? ''
    process.env.SUPABASE_ANON_KEY = process.env.EVAL_SUPABASE_ANON_KEY ?? ''
    delete process.env.VITE_SUPABASE_URL
    delete process.env.VITE_SUPABASE_ANON_KEY
    for (const strategy of ['vector','hybrid'] as const) for (const c of retrievalCases) {
      const start = performance.now()
      const row: Row = { id: c.id, suite: 'retrieval', config: strategy, status: 'inconclusive', detail: 'Missing evaluation configuration or request budget', latencyMs: 0 }
      if (process.env.EVAL_SUPABASE_URL && process.env.EVAL_SUPABASE_ANON_KEY && process.env.GOOGLE_GENERATIVE_AI_API_KEY && calls < maxCases && spent < maxUsd && !unknownSpend) {
        // Embedding cost is configured separately from generation pricing.
        const price = Number(process.env.EVAL_EMBEDDING_MAX_USD_PER_QUERY)
        if (Number.isFinite(price) && price > 0 && spent + price <= maxUsd) {
          calls++; spent += price
          try {
            const [actual] = await lookupFoods([{ name: c.query, unit: c.unit, brand: c.brand }], AbortSignal.timeout(60000), { strict: true, strategy })
            const score = scoreRetrieval(actual,c.expected)
            Object.assign(row,{status:score.pass ? 'pass':'fail', detail:actual?.name ?? 'No accepted match', incorrectMatch:score.incorrectMatch})
          } catch { row.detail = 'Retrieval infrastructure or provider unavailable' }
          // The reserved ceiling is a budget guard, not a measured cost.
        }
      }
      row.latencyMs = Math.round(performance.now() - start); rows.push(row)
    }
  }
  if (suite !== 'retrieval') for (const config of configs) for (const c of toolCases) {
    const start = performance.now()
    const row: Row = { id:c.id, suite:'tools', config:config.id, status:'inconclusive',detail:'Missing provider key, verified pricing or remaining budget',latencyMs:0 }
    if (process.env[keyNames[config.provider]] && config.pricing && calls < maxCases && spent < maxUsd && !unknownSpend) {
      calls++
      try {
        const result = await assistantChat({ messages:[{role:'user',text:c.text}],context:assistantContext,date:'2026-09-09',lang:c.id === 'a02' || c.id === 'a05' ? 'zh':'en',model:providers[config.provider](config.model),
          onUsage(usage) { row.inputTokens=usage.inputTokens; row.outputTokens=usage.outputTokens; row.estimatedUsd=estimateCost(usage.inputTokens,usage.outputTokens,config.pricing!); } },AbortSignal.timeout(60000))
        const score=scoreActions(result.actions,c.expected)
        Object.assign(row,{status:score.pass?'pass':'fail',detail:score.detail,toolCorrect:score.toolCorrect,argumentsCorrect:score.argumentsCorrect})
      } catch { row.detail='Provider unavailable, timed out, or returned an invalid result' }
      if (row.estimatedUsd === undefined) unknownSpend=true
      else spent += row.estimatedUsd
    }
    row.latencyMs=Math.round(performance.now()-start); rows.push(row)
  }
}
const groups = [...new Set(rows.map(row => row.suite + '/' + row.config))].map(group => ({group,...summarize(rows.filter(row => row.suite + '/' + row.config === group))}))
const report = {manifest,summary:summarize(rows),groups,rows,budget:{requests:calls,spentOrReservedUsd:spent,unknownSpend, note:'Observed-cost stopping can exceed the cap by the final bounded request; no retries. Unknown spend stops further calls.'}}
const dir = 'evals/results/' + manifest.startedAt.replace(/[:.]/g,'-')
await mkdir(dir,{recursive:true})
await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n')
await writeFile(dir+'/report.md',`# Evaluation ${manifest.mode}\n\nDataset: ${DATASET_VERSION}. Scorer: ${SCORER_VERSION}. Commit: ${manifest.commit}.\n\nStatus: ${report.summary.status}. No measured results are produced by dry runs.\n\n| Suite/config | Pass | Fail | Inconclusive |\n|---|---:|---:|---:|\n${groups.map(g=>`| ${g.group} | ${g.passed} | ${g.failed} | ${g.inconclusive} |`).join('\n')}\n\nModel judgment and execution correctness are evaluated separately; this report does not certify browser E2E or user timing outcomes.\n`)
console.log(JSON.stringify({directory:dir,mode:manifest.mode,summary:report.summary,groups},null,2))
if (manifest.mode==='live') process.exitCode=report.summary.status==='inconclusive'?2:report.summary.status==='fail'?1:0
