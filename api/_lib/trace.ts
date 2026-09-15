import { createHash } from 'node:crypto'
import type { LanguageModel, LanguageModelUsage } from 'ai'
import { ApiError } from './http.js'
import type { Endpoint } from './contracts.js'

export type Stage = 'auth' | 'validation' | 'limit' | 'context' | 'model' | 'retrieval' | 'output'
type StepOutcome = 'ok' | 'error' | 'cancelled' | 'timeout'

export interface ModelHooks {
  onModel?: (info: { model: string; promptVersion: string }) => void
  onUsage?: (usage: LanguageModelUsage) => void
}

// System prompts carry no user data, so their hash identifies the prompt revision without logging it.
export function describeModel(model: LanguageModel, system: string) {
  return { model: typeof model === 'string' ? model : `${model.provider}:${model.modelId}`, promptVersion: createHash('sha256').update(system).digest('hex').slice(0, 12) }
}

function classify(error: unknown): { outcome: StepOutcome; status: number; code: string } {
  if (!(error instanceof ApiError)) return { outcome: 'error', status: 500, code: 'INTERNAL_ERROR' }
  return { outcome: error.status === 499 ? 'cancelled' : error.status === 504 ? 'timeout' : 'error', status: error.status, code: error.code }
}
const elapsed = (from: number) => Math.round(performance.now() - from)

// One structured line per request. Never add prompts, messages, images, nutrition values, user IDs or provider errors.
export function createTrace(requestId: string, endpoint: Endpoint, emit: (line: string) => void = (line) => console.info(line)) {
  const started = performance.now()
  const steps: { stage: Stage; ms: number; outcome: StepOutcome; code?: string }[] = []
  const active: Stage[] = []
  // The innermost stage that threw an error is where the request failed; errors swallowed by callers never count.
  const origins = new WeakMap<object, Stage>()
  const details: { model?: string; promptVersion?: string; retrievalVersion?: string; inputTokens?: number; outputTokens?: number; proposals?: number; actionIds?: string[] } = {}
  let finished = false
  return {
    async step<T>(stage: Stage, work: () => Promise<T>): Promise<T> {
      const begin = performance.now()
      active.push(stage)
      try {
        const value = await work()
        steps.push({ stage, ms: elapsed(begin), outcome: 'ok' })
        return value
      } catch (error) {
        const { outcome, code } = classify(error)
        steps.push({ stage, ms: elapsed(begin), outcome, code })
        if (typeof error === 'object' && error !== null && !origins.has(error)) origins.set(error, stage)
        throw error
      } finally {
        active.splice(active.lastIndexOf(stage), 1)
      }
    },
    record(extra: typeof details) { Object.assign(details, extra) },
    hooks: {
      onModel(info) { details.model = info.model; details.promptVersion = info.promptVersion },
      onUsage(usage) {
        if (usage.inputTokens !== undefined) details.inputTokens = (details.inputTokens ?? 0) + usage.inputTokens
        if (usage.outputTokens !== undefined) details.outputTokens = (details.outputTokens ?? 0) + usage.outputTokens
      },
    } satisfies ModelHooks,
    finish(error?: unknown) {
      if (finished) return
      finished = true
      let result: Record<string, unknown> = { outcome: 'completed', status: 200 }
      if (error !== undefined) {
        const { outcome, status, code } = classify(error)
        // A deadline can reject while a stage is still running; that stage is where it stopped.
        const failedStage = (typeof error === 'object' && error !== null ? origins.get(error) : undefined) ?? active.at(-1) ?? 'request'
        result = { outcome: outcome === 'error' ? 'failed' : outcome, status, code, failedStage }
      }
      emit(JSON.stringify({ event: 'ai_request', requestId, endpoint, ...result, durationMs: elapsed(started), steps, ...details }))
    },
  }
}
