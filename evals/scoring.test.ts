import { expect, it } from 'vitest'
import { estimateCost, scoreActions, scoreRetrieval, summarize } from './scoring'
const workout = { actionId: '10000000-0000-4000-8000-000000000001', date: '2026-09-09', action: { type: 'workout', workoutType: 'walk', durationMin: 30, calories: 100 } }
it('fails an otherwise-correct response containing an extra unwanted tool', () => {
  expect(scoreActions([workout, workout], [{ type: 'workout' }]).pass).toBe(false)
})
it('scores tool selection separately from arguments', () => {
  expect(scoreActions([workout], [{ type: 'workout', fields: { durationMin: [40, 60] } }])).toMatchObject({ toolCorrect: true, argumentsCorrect: false, pass: false })
})
it('validates schemas and handles no-tool requests', () => {
  expect(scoreActions([{ action: { type: 'workout' } }], []).pass).toBe(false)
  expect(scoreActions([], []).pass).toBe(true)
})
it('never reports an empty or skipped run as passing', () => {
  expect(summarize([]).status).toBe('inconclusive')
  expect(summarize([{ id: '1', config: 'x', suite: 'tools', status: 'inconclusive', detail: 'quota', latencyMs: 0 }]).passRate).toBeNull()
})
it('separates wrong accepted matches from abstentions', () => {
  expect(scoreRetrieval({ matched: true, name: 'Wrong' }, 'Right')).toEqual({ pass: false, incorrectMatch: true })
  expect(scoreRetrieval(null, 'Right')).toEqual({ pass: false, incorrectMatch: false })
})
it('reports unknown pricing as unavailable instead of free', () => {
  expect(estimateCost(100, 50)).toBeUndefined()
  expect(estimateCost(100, 50, { inputPerMillion: 1, outputPerMillion: 2 })).toBe(0.0002)
})
