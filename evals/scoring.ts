import { proposalSchema } from '../api/_lib/contracts'
import type { ActionProposal } from '../api/_lib/contracts'
export const SCORER_VERSION = '2.0.0'
export type ExpectedAction = { type: 'log' | 'save' | 'workout'; fields?: Record<string, string | number | [number, number]> }
export type Row = { id: string; suite: string; config: string; status: 'pass' | 'fail' | 'inconclusive'; detail: string; latencyMs: number; inputTokens?: number; outputTokens?: number; estimatedUsd?: number; toolCorrect?: boolean; argumentsCorrect?: boolean; incorrectMatch?: boolean }
export function scoreActions(proposals: unknown[], expected: ExpectedAction[]) {
  const parsed = proposals.map(p => proposalSchema.safeParse(p))
  if (parsed.some(p => !p.success)) return { pass: false, toolCorrect: false, argumentsCorrect: false, detail: 'Invalid proposal schema' }
  const actions = parsed.map(p => p.data!.action)
  const toolCorrect = actions.length === expected.length && expected.every(e => actions.filter(a => a.type === e.type).length === expected.filter(x => x.type === e.type).length)
  const remaining = [...actions]
  const argumentsCorrect = toolCorrect && expected.every(e => {
    const index = remaining.findIndex(a => a.type === e.type && Object.entries(e.fields ?? {}).every(([key, value]) => {
      const actual = (a as unknown as Record<string, unknown>)[key]
      return Array.isArray(value) ? typeof actual === 'number' && Number.isFinite(actual) && actual >= value[0] && actual <= value[1] : actual === value
    }))
    if (index < 0) return false
    remaining.splice(index, 1)
    return true
  })
  return { pass: toolCorrect && argumentsCorrect, toolCorrect, argumentsCorrect, detail: !toolCorrect ? 'Unexpected or missing tools' : !argumentsCorrect ? 'Arguments did not meet expectations' : 'Matched expected actions' }
}
export function scoreRetrieval(actual: { matched: boolean; name: string } | null, expected: string | null) {
  const name = actual?.matched ? actual.name : null
  return { pass: name === expected, incorrectMatch: name !== null && name !== expected }
}
export function summarize(rows: Row[]) {
  const scored = rows.filter(row => row.status !== 'inconclusive')
  const passed = rows.filter(row => row.status === 'pass').length
  return { total: rows.length, passed, failed: scored.length - passed, inconclusive: rows.length - scored.length,
    passRate: scored.length ? passed / scored.length : null,
    status: !rows.length || rows.some(row => row.status === 'inconclusive') ? 'inconclusive' : rows.some(row => row.status === 'fail') ? 'fail' : 'pass',
    estimatedUsd: rows.length && rows.every(row => row.estimatedUsd !== undefined) ? rows.reduce((sum,row) => sum + row.estimatedUsd!,0) : null }
}
export function estimateCost(input: number | undefined, output: number | undefined, rates?: { inputPerMillion: number; outputPerMillion: number }) {
  if (input === undefined || output === undefined || !rates) return undefined
  return (input * rates.inputPerMillion + output * rates.outputPerMillion) / 1e6
}
export type EvaluatedProposal = ActionProposal
