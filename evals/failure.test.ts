import { expect, it } from 'vitest'
import { ApiError } from '../api/_lib/http'
import { failureDetail } from './failure'

it('records only known public failure codes without sensitive provider text', () => {
  expect(failureDetail(new ApiError(503, 'AI_UNAVAILABLE', 'secret request body'))).toBe('Provider failure: AI_UNAVAILABLE (HTTP 503)')
  expect(failureDetail(new Error('secret request body'))).not.toContain('secret')
  expect(failureDetail(new ApiError(500, 'secret', 'secret'))).not.toContain('secret')
})
