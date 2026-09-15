import { createHash } from 'node:crypto'
import type { Row } from './scoring'

type Env = Record<string, string | undefined>
export type Suite = 'all' | 'tools' | 'retrieval'
export type CatalogSource = 'evaluation-database' | 'none'
export interface ModelConfig { id: string; provider: 'google' | 'openai' | 'anthropic'; model: string; pricing: { inputPerMillion: number; outputPerMillion: number; verifiedOn: string } | null }
export interface RunGroup { suite: 'retrieval' | 'tools'; config: string; cases: number; caseLimit: number; usdLimit: number }
export interface GroupUsage { calls: number; spent: number; unknownSpend: boolean }

export const keyNames = { google: 'GOOGLE_GENERATIVE_AI_API_KEY', openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY' } as const
const applicationDatabaseVariables = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, '').toLowerCase()

// Applies to every suite, so a tools-only run cannot reach an application database left in the shell.
export function isolateEvaluationEnv(env: Env): { catalog: CatalogSource } {
  const url = env.EVAL_SUPABASE_URL?.trim(), key = env.EVAL_SUPABASE_ANON_KEY?.trim()
  if (Boolean(url) !== Boolean(key)) throw new Error('Set both EVAL_SUPABASE_URL and EVAL_SUPABASE_ANON_KEY, or neither')
  const applicationUrls = [env.SUPABASE_URL, env.VITE_SUPABASE_URL].filter((value): value is string => Boolean(value)).map(normalizeUrl)
  if (url && applicationUrls.includes(normalizeUrl(url))) throw new Error('EVAL_SUPABASE_URL must not be the application database')
  for (const name of applicationDatabaseVariables) delete env[name]
  if (!url || !key) return { catalog: 'none' }
  env.SUPABASE_URL = url
  env.SUPABASE_ANON_KEY = key
  return { catalog: 'evaluation-database' }
}

export function embeddingBudget(env: Env): number | null {
  const value = Number(env.EVAL_EMBEDDING_MAX_USD_PER_QUERY)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function retrievalIssues(catalog: CatalogSource, env: Env): string[] {
  const issues: string[] = []
  if (catalog !== 'evaluation-database') issues.push('EVAL_SUPABASE_URL and EVAL_SUPABASE_ANON_KEY are required')
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) issues.push('missing GOOGLE_GENERATIVE_AI_API_KEY for query embeddings')
  if (embeddingBudget(env) === null) issues.push('EVAL_EMBEDDING_MAX_USD_PER_QUERY must be a positive per-query ceiling')
  return issues
}

export function configIssues(config: ModelConfig, env: Env): string[] {
  const issues: string[] = []
  if (!env[keyNames[config.provider]]) issues.push(`missing ${keyNames[config.provider]}`)
  if (!config.pricing) issues.push('pricing has not been verified')
  if (/^SET_|PLACEHOLDER/i.test(config.model)) issues.push('model ID is a placeholder')
  return issues
}

// Allowances are proportional to case counts, so an early group cannot spend a later configuration's budget.
export function planGroups(suite: Suite, configIds: string[], counts: { retrieval: number; tools: number }, maxCases: number, maxUsd: number) {
  const base = [
    ...(suite === 'tools' ? [] : ['vector', 'hybrid'].map(config => ({ suite: 'retrieval' as const, config, cases: counts.retrieval }))),
    ...(suite === 'retrieval' ? [] : configIds.map(config => ({ suite: 'tools' as const, config, cases: counts.tools }))),
  ]
  const requiredCases = base.reduce((sum, group) => sum + group.cases, 0)
  const complete = maxCases >= requiredCases
  const groups: RunGroup[] = base.map(group => ({ ...group,
    caseLimit: complete ? group.cases : Math.floor(maxCases * group.cases / requiredCases),
    usdLimit: requiredCases ? maxUsd * group.cases / requiredCases : 0 }))
  return { groups, requiredCases, complete }
}

export function hasAllowance(group: RunGroup, used: GroupUsage, reserveUsd = 0): boolean {
  return used.calls < group.caseLimit && !used.unknownSpend && used.spent < group.usdLimit && used.spent + reserveUsd <= group.usdLimit
}

// Row IDs and timestamps change on reseed without changing retrieval behaviour, so only content is hashed.
export function catalogFingerprint(rows: Record<string, unknown>[]): { rows: number; fingerprint: string } {
  const canonical = rows.map(row => JSON.stringify(Object.keys(row).sort().map(key => [key, row[key]]))).sort()
  return { rows: rows.length, fingerprint: createHash('sha256').update(canonical.join('\n')).digest('hex') }
}

export const datasetFingerprint = (cases: object[]) => catalogFingerprint(cases as Record<string, unknown>[]).fingerprint

// A frozen case set must match its lock exactly, so results never come from cases edited after tuning.
export function assertFrozen(cases: object[], lock: { version: string; sha256: string; cases: number }, version: string): void {
  if (lock.version !== version || lock.cases !== cases.length || lock.sha256 !== datasetFingerprint(cases)) {
    throw new Error('The retrieval holdout differs from evals/holdout.lock.json; restore the frozen cases instead of editing them')
  }
}

export interface ReportLike {
  manifest: { dataset: string; versions: Record<string, string>; catalog?: { fingerprint: string | null }; toolRetrieval?: CatalogSource; retrievalSet?: { name: string; fingerprint: string } }
  rows: Row[]
}
const usesCatalog = (report: ReportLike) => report.rows.some(row => row.suite === 'retrieval') || report.manifest.toolRetrieval === 'evaluation-database'

// The local seed-file hash does not identify the queried catalog; only the recorded fingerprint does.
export function assertComparable(before: ReportLike, after: ReportLike): void {
  if (before.manifest.dataset !== after.manifest.dataset || before.manifest.versions['evals/dataset.ts'] !== after.manifest.versions['evals/dataset.ts']) throw new Error('Dataset must match for a paired comparison')
  if (before.manifest.toolRetrieval !== after.manifest.toolRetrieval) throw new Error('Tool lookups must use the same retrieval source')
  const hasRetrieval = (report: ReportLike) => report.rows.some(row => row.suite === 'retrieval')
  if ((hasRetrieval(before) || hasRetrieval(after)) && before.manifest.retrievalSet?.fingerprint !== after.manifest.retrievalSet?.fingerprint) {
    throw new Error('Retrieval reports must use the same retrieval case set')
  }
  if (usesCatalog(before) || usesCatalog(after)) {
    const fingerprint = before.manifest.catalog?.fingerprint
    if (!fingerprint || fingerprint !== after.manifest.catalog?.fingerprint) throw new Error('Both reports must record the same evaluated catalog fingerprint')
  }
}
