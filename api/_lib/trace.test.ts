import { expect, it } from 'vitest'
import { createTrace, describeModel } from './trace.js'
import { ApiError } from './http.js'

function capture() {
  const lines: Record<string, unknown>[] = []
  return { lines, emit: (line: string) => lines.push(JSON.parse(line)) }
}

it('emits one line and ignores retrieval errors that a model step recovered from', async () => {
  const { lines, emit } = capture()
  const trace = createTrace('req-1', 'assistant', emit)
  await trace.step('model', async () => {
    await trace.step('retrieval', async () => { throw new Error('catalog down') }).catch(() => null)
    trace.hooks.onUsage({ inputTokens: 10, outputTokens: 4, totalTokens: 14 } as never)
  })
  trace.finish()
  trace.finish(new Error('late'))
  expect(lines).toHaveLength(1)
  expect(lines[0]).toMatchObject({ event: 'ai_request', requestId: 'req-1', outcome: 'completed', inputTokens: 10, outputTokens: 4 })
  expect(lines[0].steps).toEqual([expect.objectContaining({ stage: 'retrieval', outcome: 'error', code: 'INTERNAL_ERROR' }), expect.objectContaining({ stage: 'model', outcome: 'ok' })])
  expect(JSON.stringify(lines)).not.toContain('catalog down')
})

it('attributes a failure to the innermost stage that threw it', async () => {
  const { lines, emit } = capture()
  const trace = createTrace('req-2', 'recognize', emit)
  const denied = new ApiError(429, 'RATE_LIMITED', 'Later')
  await trace.step('model', () => trace.step('retrieval', async () => { throw denied })).catch(error => trace.finish(error))
  expect(lines[0]).toMatchObject({ outcome: 'failed', status: 429, code: 'RATE_LIMITED', failedStage: 'retrieval' })
})

it('reports a deadline that fires while a stage is still running as a timeout in that stage', () => {
  const { lines, emit } = capture()
  const trace = createTrace('req-3', 'knowledge', emit)
  void trace.step('model', () => new Promise(() => {}))
  trace.finish(new ApiError(504, 'REQUEST_TIMEOUT', 'Timed out'))
  expect(lines[0]).toMatchObject({ outcome: 'timeout', status: 504, failedStage: 'model' })
  const cancelled = capture()
  createTrace('req-4', 'knowledge', cancelled.emit).finish(new ApiError(499, 'REQUEST_CANCELLED', 'Cancelled'))
  expect(cancelled.lines[0]).toMatchObject({ outcome: 'cancelled', failedStage: 'request' })
})

it('versions prompts by hash without exposing their text', () => {
  const first = describeModel('provider-model', 'System prompt A')
  expect(first).toEqual({ model: 'provider-model', promptVersion: expect.stringMatching(/^[0-9a-f]{12}$/) })
  expect(describeModel('provider-model', 'System prompt B').promptVersion).not.toBe(first.promptVersion)
})
