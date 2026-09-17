import { expect, it, vi } from 'vitest'
import { APICallError } from 'ai'
import { recognitionModelRequest } from './model-request.js'
import { createTrace } from './trace.js'

function providerError(statusCode: number) {
  return new APICallError({ message: 'private provider details', url: 'https://provider.invalid',
    requestBodyValues: { image: 'private image' }, responseBody: 'private output', statusCode })
}

it('recovers from a temporary 503 with one retry', async () => {
  const work = vi.fn().mockRejectedValueOnce(providerError(503)).mockResolvedValue({ items: [] })
  await expect(recognitionModelRequest(work)).resolves.toEqual({ items: [] })
  expect(work).toHaveBeenCalledTimes(2)
})

it('bounds retries and exposes only a safe failure to the response and trace', async () => {
  const work = vi.fn().mockRejectedValue(providerError(503))
  const emit = vi.fn()
  const trace = createTrace('req-test', 'recognize', emit)
  await trace.step('model', () => recognitionModelRequest(work)).catch(error => {
    expect(error).toMatchObject({ status: 503, code: 'AI_UNAVAILABLE' })
    expect(error.message).not.toContain('private')
    trace.finish(error)
  })
  expect(work).toHaveBeenCalledTimes(2)
  expect(JSON.parse(emit.mock.calls[0][0])).toMatchObject({ status: 503, code: 'AI_UNAVAILABLE', failedStage: 'model' })
  expect(emit.mock.calls[0][0]).not.toContain('private')
})

it.each([[429, 'AI_RATE_LIMITED'], [403, 'AI_CONFIGURATION_ERROR'], [400, 'AI_REQUEST_REJECTED']])('does not retry provider status %s', async (status, code) => {
  const work = vi.fn().mockRejectedValue(providerError(Number(status)))
  await expect(recognitionModelRequest(work)).rejects.toMatchObject({ code })
  expect(work).toHaveBeenCalledOnce()
})

it('does not retry after cancellation during backoff', async () => {
  const controller = new AbortController()
  const reason = new Error('request cancelled')
  const work = vi.fn().mockRejectedValue(providerError(503))
  const result = recognitionModelRequest(work, controller.signal)
  const assertion = expect(result).rejects.toBe(reason)
  await Promise.resolve()
  controller.abort(reason)
  await assertion
  expect(work).toHaveBeenCalledOnce()
})
