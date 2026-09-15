import { expect, it } from 'vitest'
import { assertComparable, assertFrozen, catalogFingerprint, configIssues, datasetFingerprint, hasAllowance, isolateEvaluationEnv, planGroups, retrievalIssues, type ReportLike } from './harness'

const app = { SUPABASE_URL: 'https://app.supabase.co', SUPABASE_ANON_KEY: 'app', VITE_SUPABASE_URL: 'https://app.supabase.co', VITE_SUPABASE_ANON_KEY: 'app', SUPABASE_SERVICE_ROLE_KEY: 'service' }

it('removes application database access from tools-only runs without an evaluation catalog', () => {
  const env: Record<string, string | undefined> = { ...app }
  expect(isolateEvaluationEnv(env)).toEqual({ catalog: 'none' })
  expect(env).toEqual({})
})

it('points every lookup at the evaluation database and refuses unsafe configuration', () => {
  const env: Record<string, string | undefined> = { ...app, EVAL_SUPABASE_URL: 'https://eval.supabase.co', EVAL_SUPABASE_ANON_KEY: 'eval' }
  expect(isolateEvaluationEnv(env)).toEqual({ catalog: 'evaluation-database' })
  expect(env).toMatchObject({ SUPABASE_URL: 'https://eval.supabase.co', SUPABASE_ANON_KEY: 'eval' })
  expect(env.VITE_SUPABASE_URL).toBeUndefined()
  expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
  expect(() => isolateEvaluationEnv({ ...app, EVAL_SUPABASE_URL: 'https://APP.supabase.co/', EVAL_SUPABASE_ANON_KEY: 'x' })).toThrow('application database')
  expect(() => isolateEvaluationEnv({ EVAL_SUPABASE_URL: 'https://eval.supabase.co' })).toThrow('both')
})

it('reports incomplete model and retrieval configuration before any call', () => {
  expect(configIssues({ id: 'a', provider: 'anthropic', model: 'SET_A_CURRENT_SUPPORTED_MODEL_ID', pricing: null }, {})).toEqual(['missing ANTHROPIC_API_KEY', 'pricing has not been verified', 'model ID is a placeholder'])
  expect(configIssues({ id: 'g', provider: 'google', model: 'gemini', pricing: { inputPerMillion: 1, outputPerMillion: 2, verifiedOn: '2026-09-15' } }, { GOOGLE_GENERATIVE_AI_API_KEY: 'k' })).toEqual([])
  expect(retrievalIssues('none', { EVAL_EMBEDDING_MAX_USD_PER_QUERY: '0' })).toHaveLength(3)
})

it('gives every configuration its own allowance when the case cap is below the matrix', () => {
  expect(planGroups('all', ['a', 'b', 'c'], { retrieval: 20, tools: 12 }, 76, 1)).toMatchObject({ requiredCases: 76, complete: true })
  const { groups, complete } = planGroups('tools', ['a', 'b', 'c'], { retrieval: 20, tools: 12 }, 18, 0.9)
  expect(complete).toBe(false)
  expect(groups.map(group => [group.config, group.caseLimit])).toEqual([['a', 6], ['b', 6], ['c', 6]])
  expect(groups.every(group => Math.abs(group.usdLimit - 0.3) < 1e-9)).toBe(true)
})

it('stops a group on exhausted cases, spend, reserved spend or unknown charges', () => {
  const group = { suite: 'tools' as const, config: 'a', cases: 2, caseLimit: 2, usdLimit: 0.1 }
  expect(hasAllowance(group, { calls: 1, spent: 0.05, unknownSpend: false })).toBe(true)
  expect(hasAllowance(group, { calls: 2, spent: 0, unknownSpend: false })).toBe(false)
  expect(hasAllowance(group, { calls: 0, spent: 0.1, unknownSpend: false })).toBe(false)
  expect(hasAllowance(group, { calls: 0, spent: 0.08, unknownSpend: false }, 0.03)).toBe(false)
  expect(hasAllowance(group, { calls: 0, spent: 0, unknownSpend: true })).toBe(false)
})

it('fingerprints catalog content independently of row and key order', () => {
  const a = { name: '牛奶', unit: 'ml', calories: 61 }, b = { name: '鸡蛋', unit: 'g', calories: 143 }
  expect(catalogFingerprint([a, b])).toEqual(catalogFingerprint([{ calories: 143, unit: 'g', name: '鸡蛋' }, a]))
  expect(catalogFingerprint([a, b]).fingerprint).not.toBe(catalogFingerprint([a, { ...b, calories: 144 }]).fingerprint)
})

it('refuses comparisons across different or unrecorded catalogs', () => {
  const report = (fingerprint: string | null): ReportLike => ({ manifest: { dataset: 'd', versions: { 'evals/dataset.ts': 'h' }, catalog: { fingerprint }, toolRetrieval: 'evaluation-database' },
    rows: [{ id: 'r01', suite: 'retrieval', config: 'hybrid', status: 'pass', detail: '', latencyMs: 1 }] })
  expect(() => assertComparable(report('x'), report('x'))).not.toThrow()
  expect(() => assertComparable(report('x'), report('y'))).toThrow('catalog fingerprint')
  expect(() => assertComparable(report(null), report(null))).toThrow('catalog fingerprint')
  expect(() => assertComparable(report('x'), { ...report('x'), manifest: { ...report('x').manifest, toolRetrieval: 'none' } })).toThrow('retrieval source')
  const withSet = (fingerprint: string): ReportLike => ({ ...report('x'), manifest: { ...report('x').manifest, retrievalSet: { name: 'holdout', fingerprint } } })
  expect(() => assertComparable(withSet('a'), withSet('a'))).not.toThrow()
  expect(() => assertComparable(withSet('a'), withSet('b'))).toThrow('same retrieval case set')
})

it('refuses a holdout whose cases no longer match the lock', () => {
  const cases = [{ id: 'h01', query: 'a', expected: null }]
  const lock = { version: 'v1', sha256: datasetFingerprint(cases), cases: 1 }
  expect(() => assertFrozen(cases, lock, 'v1')).not.toThrow()
  expect(() => assertFrozen([{ ...cases[0], expected: 'b' }], lock, 'v1')).toThrow('holdout.lock.json')
  expect(() => assertFrozen(cases, lock, 'v2')).toThrow('holdout.lock.json')
})
