import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { assistantChat } from '../api/_lib/assistant'
import { lookupFoods, type FoodQuery } from '../api/_lib/rag'
import { RETRIEVAL_VERSION } from '../api/_lib/retrieval'
import type { Database } from '../src/lib/database.types'
import { assistantContext } from './cases'
import { failureDetail } from './failure'
import { DATASET_VERSION, retrievalCases, toolCases } from './dataset'
import { HOLDOUT_VERSION, retrievalHoldout } from './holdout'
import { assertFrozen, catalogFingerprint, configIssues, datasetFingerprint, embeddingBudget, hasAllowance, isolateEvaluationEnv, planGroups, retrievalIssues, type GroupUsage, type RunGroup } from './harness'
import { SCORER_VERSION, estimateCost, scoreActions, scoreRetrieval, summarize, type Row } from './scoring'

// Live runs are opt-in. This runner never loads production .env.local credentials.
const args = process.argv.slice(2)
const flags = new Set(['--live','--dry-run','--allow-partial'])
const values = new Set(['--config','--suite','--max-cases','--max-usd','--retrieval-set'])
const options: Record<string,string> = {}
for (let i = 0; i < args.length; i++) {
  if (flags.has(args[i])) options[args[i]] = 'true'
  else if (values.has(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) options[args[i]] = args[++i]
  else throw new Error(`Unknown or missing option: ${args[i]}`)
}
const suite = z.enum(['all','tools','retrieval']).parse(options['--suite'] ?? 'all')
const maxCases = z.coerce.number().int().min(1).max(100).parse(options['--max-cases'] ?? 76)
const maxUsd = z.coerce.number().positive().max(20).parse(options['--max-usd'] ?? 0.5)
const allowPartial = Boolean(options['--allow-partial'])
const retrievalSetName = z.enum(['dev','holdout']).parse(options['--retrieval-set'] ?? 'dev')
// The holdout must match its lock so results can never come from cases edited after tuning.
if (retrievalSetName === 'holdout') assertFrozen(retrievalHoldout, JSON.parse(await readFile('evals/holdout.lock.json','utf8')), HOLDOUT_VERSION)
const selectedRetrievalCases = retrievalSetName === 'holdout' ? retrievalHoldout : retrievalCases
const retrievalSet = { name: retrievalSetName, version: retrievalSetName === 'holdout' ? HOLDOUT_VERSION : DATASET_VERSION, cases: selectedRetrievalCases.length, fingerprint: datasetFingerprint(selectedRetrievalCases) }
const modelSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/), provider: z.enum(['google','openai','anthropic']), model: z.string().min(1),
  pricing: z.object({ inputPerMillion: z.number().nonnegative(), outputPerMillion: z.number().nonnegative(), verifiedOn: z.iso.date() }).nullable() }).strict()
const configs = z.array(modelSchema).min(1).max(3).parse(JSON.parse(await readFile(options['--config'] ?? 'evals/models.example.json', 'utf8')))
if (new Set(configs.map(c => c.id)).size !== configs.length) throw new Error('Model configuration IDs must be unique')

// Isolation runs before any lookup can create a database client.
const database = isolateEvaluationEnv(process.env)
const mode = options['--live'] && !options['--dry-run'] ? 'live' : 'dry-run'
const embeddingUsd = embeddingBudget(process.env)
const plan = planGroups(suite, configs.map(c => c.id), { retrieval: selectedRetrievalCases.length, tools: toolCases.length }, maxCases, maxUsd)
const preflight: string[] = []
if (!plan.complete) preflight.push(`--max-cases ${maxCases} is below the complete matrix of ${plan.requiredCases} cases`)
if (suite !== 'tools') preflight.push(...retrievalIssues(database.catalog, process.env).map(issue => `retrieval: ${issue}`))
if (suite !== 'retrieval') {
  for (const config of configs) preflight.push(...configIssues(config, process.env).map(issue => `${config.id}: ${issue}`))
  if (database.catalog === 'evaluation-database') preflight.push(...retrievalIssues(database.catalog, process.env).map(issue => `tool lookups: ${issue}`))
}

async function readCatalog() {
  const db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('foods').select('name,name_en,aliases,unit,base_amount,protein,carbs,fat,calories,brand,preparation,source,embedding')
      .order('id').range(from, from + 499).abortSignal(AbortSignal.timeout(60000))
    if (error) throw new Error('Catalog unavailable')
    rows.push(...data)
    if (data.length < 500) return rows
  }
}
const catalog: { source: typeof database.catalog; rows: number | null; fingerprint: string | null } = { source: database.catalog, rows: null, fingerprint: null }
if (mode === 'live' && database.catalog === 'evaluation-database') {
  try { Object.assign(catalog, catalogFingerprint(await readCatalog())) }
  catch { preflight.push('evaluation catalog could not be read') }
}
const run = mode === 'live' && (!preflight.length || allowPartial)

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
// scripts/foods.json is the local seed file only; catalog.fingerprint identifies what was actually queried.
const versions = Object.fromEntries(await Promise.all(['api/_lib/assistant.ts','api/_lib/contracts.ts','api/_lib/retrieval.ts','api/_lib/model-request.ts','scripts/foods.json','evals/run.ts','evals/failure.ts','evals/dataset.ts','evals/scoring.ts','evals/harness.ts','evals/holdout.ts','evals/holdout.lock.json'].map(async file => [file, hash(await readFile(file,'utf8'))])))
const manifest = { dataset: DATASET_VERSION, scorer: SCORER_VERSION, retrieval: RETRIEVAL_VERSION,
  retrievalComparison: 'Ablation of vector-only and hybrid selection under identical metadata and unit filters; not a fixed legacy baseline',
  versions, commit: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), dirty: Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()),
  configs, suite, maxCases, maxUsd, allowPartial, startedAt: new Date().toISOString(), mode, catalog, toolRetrieval: catalog.source, retrievalSet, preflight, plan: plan.groups }

const rows: Row[] = []
const usage = new Map<RunGroup, GroupUsage>(plan.groups.map(group => [group, { calls: 0, spent: 0, unknownSpend: false }]))
const providers = { google, openai, anthropic }
const blocked = 'Not run: preflight failed; see manifest.preflight'
const exhausted = { reason: 'budget', detail: 'Group case or spending allowance exhausted' } as const
function scored(row: Row, pass: boolean, detail: string, extra: Partial<Row>) {
  delete row.reason
  Object.assign(row, { status: pass ? 'pass' : 'fail', detail, ...extra })
}

if (mode === 'live') for (const group of plan.groups) {
  const used = usage.get(group)!
  if (group.suite === 'retrieval') {
    const issues = retrievalIssues(catalog.source, process.env)
    for (const c of selectedRetrievalCases) {
      const start = performance.now()
      const row: Row = { id: c.id, suite: 'retrieval', config: group.config, status: 'inconclusive', reason: 'configuration', detail: issues.join('; ') || blocked, latencyMs: 0 }
      if (run && !issues.length && !catalog.fingerprint) Object.assign(row, { reason: 'infrastructure', detail: 'Evaluation catalog unavailable' })
      else if (run && !issues.length) {
        if (!hasAllowance(group, used, embeddingUsd!)) Object.assign(row, exhausted)
        else {
          // The reserved ceiling is a budget guard, not a measured embedding cost.
          used.calls++; used.spent += embeddingUsd!; row.reservedUsd = embeddingUsd!
          try {
            const [actual] = await lookupFoods([{ name: c.query, unit: c.unit, brand: c.brand, preparation: c.preparation }], AbortSignal.timeout(60000), { strict: true, strategy: group.config as 'vector' | 'hybrid' })
            const score = scoreRetrieval(actual, c.expected)
            scored(row, score.pass, actual?.name ?? 'No accepted match', { incorrectMatch: score.incorrectMatch, abstained: score.abstained })
          } catch { Object.assign(row, { reason: 'infrastructure', detail: 'Retrieval infrastructure or provider unavailable' }) }
        }
      }
      row.latencyMs = Math.round(performance.now() - start); rows.push(row)
    }
    continue
  }
  const config = configs.find(item => item.id === group.config)!
  const issues = configIssues(config, process.env)
  const lookupIssue = catalog.source === 'none' ? null : !catalog.fingerprint ? 'Evaluation catalog unavailable'
    : retrievalIssues(catalog.source, process.env).length ? 'Tool lookup embedding configuration unavailable' : null
  for (const c of toolCases) {
    const start = performance.now()
    const row: Row = { id: c.id, suite: 'tools', config: config.id, status: 'inconclusive', reason: 'configuration', detail: issues.join('; ') || lookupIssue || blocked, latencyMs: 0 }
    if (run && !issues.length && !lookupIssue) {
      if (!hasAllowance(group, used)) Object.assign(row, used.unknownSpend
        ? { reason: 'budget', detail: 'Stopped because a previous request has unknown cost; allowance was not necessarily exhausted' }
        : exhausted)
      else {
        used.calls++
        const signal = AbortSignal.timeout(60000)
        let lookups = 0, lookupFailed = false
        // Without an evaluation catalog, lookups deterministically return no match and never reach a database.
        const lookup = async (query: FoodQuery) => {
          if (catalog.source === 'none') return null
          lookups++
          try { return (await lookupFoods([query], signal, { strict: true }))[0] ?? null }
          catch (error) { lookupFailed = true; throw error }
        }
        try {
          const result = await assistantChat({ messages:[{role:'user',text:c.text}], context:assistantContext, date:'2026-09-09', lang:c.id === 'a02' || c.id === 'a05' ? 'zh':'en', model:providers[config.provider](config.model), lookup,
            onUsage(usage) { row.inputTokens=usage.inputTokens; row.outputTokens=usage.outputTokens; row.estimatedUsd=estimateCost(usage.inputTokens,usage.outputTokens,config.pricing!) } }, signal)
          if (lookupFailed) Object.assign(row, { reason: 'infrastructure', detail: 'Nutrition lookup unavailable during the case' })
          else {
            const score = scoreActions(result.actions, c.expected)
            scored(row, score.pass, score.detail, { toolCorrect: score.toolCorrect, argumentsCorrect: score.argumentsCorrect })
          }
        } catch (error) { Object.assign(row, { reason: 'infrastructure', detail: failureDetail(error) }) }
        if (lookups) { row.reservedUsd = lookups * embeddingUsd!; used.spent += row.reservedUsd }
        if (row.estimatedUsd === undefined) used.unknownSpend = true
        else used.spent += row.estimatedUsd
      }
    }
    row.latencyMs = Math.round(performance.now() - start); rows.push(row)
    console.log(`${group.config}/${c.id}: ${row.status} (${row.latencyMs} ms)`)
  }
}

const coverage = plan.groups.map(group => {
  const name = `${group.suite}/${group.config}`
  const scoredCases = rows.filter(row => `${row.suite}/${row.config}` === name && row.status !== 'inconclusive').length
  return { group: name, required: group.cases, scored: scoredCases, complete: scoredCases === group.cases, caseLimit: group.caseLimit, usdLimit: group.usdLimit, ...usage.get(group)! }
})
const groups = coverage.map(item => ({ group: item.group, ...summarize(rows.filter(row => `${row.suite}/${row.config}` === item.group)) }))
const report = { manifest, summary: summarize(rows), groups, coverage, rows,
  budgetNote: 'Each group has its own proportional allowance. Observed-cost stopping can exceed a group allowance by the final bounded request; embedding spend is a reserved ceiling. No retries. Unknown spend stops that group.' }
const dir = 'evals/results/' + manifest.startedAt.replace(/[:.]/g,'-')
await mkdir(dir,{recursive:true})
await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n')
const catalogLine = catalog.fingerprint ? `evaluation database, ${catalog.rows} rows, sha256 ${catalog.fingerprint}` : catalog.source === 'none' ? 'none (tool lookups return no match)' : 'evaluation database (not read)'
await writeFile(dir+'/report.md',`# Evaluation ${mode}

Dataset: ${DATASET_VERSION}. Scorer: ${SCORER_VERSION}. Commit: ${manifest.commit}${manifest.dirty ? ' (dirty)' : ''}.

Catalog: ${catalogLine}. Retrieval set: ${retrievalSet.name} (${retrievalSet.version}, ${retrievalSet.cases} cases, sha256 ${retrievalSet.fingerprint}). Retrieval comparison: ${manifest.retrievalComparison}.

Status: ${report.summary.status}.${mode === 'dry-run' ? ' Dry runs produce no measured results.' : ''}
${preflight.length ? `\nPreflight issues${run ? ' (run continued with --allow-partial)' : ''}:\n\n${preflight.map(issue => `- ${issue}`).join('\n')}\n` : ''}
| Suite/config | Scored/required | Pass | Fail | Wrong match | Abstained | Config | Budget | Infrastructure |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${groups.map((g, i) => `| ${g.group} | ${coverage[i].scored}/${coverage[i].required} | ${g.passed} | ${g.failed} | ${g.incorrectMatches} | ${g.abstentions} | ${g.inconclusiveReasons.configuration} | ${g.inconclusiveReasons.budget} | ${g.inconclusiveReasons.infrastructure} |`).join('\n')}

Model judgment and execution correctness are evaluated separately; this report does not certify browser E2E or user timing outcomes.
`)
console.log(JSON.stringify({directory:dir,mode,preflight,summary:report.summary,coverage},null,2))
if (mode==='live') process.exitCode=report.summary.status==='inconclusive'?2:report.summary.status==='fail'?1:0
