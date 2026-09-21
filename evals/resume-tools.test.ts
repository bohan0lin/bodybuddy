import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { assertFrozen } from './harness'
import { RESUME_TOOLS_VERSION, resumeToolCases } from './resume-tools'

it('keeps the predeclared 50-case benchmark unchanged after freezing', () => {
  expect(resumeToolCases).toHaveLength(50)
  expect(new Set(resumeToolCases.map(item=>item.text)).size).toBe(50)
  expect(() => assertFrozen(resumeToolCases, JSON.parse(readFileSync('evals/resume-tools.lock.json','utf8')), RESUME_TOOLS_VERSION)).not.toThrow()
})
