// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Day from './Day'

const mocks = vi.hoisted(() => ({ deleteMeal: vi.fn(), deleteWorkout: vi.fn() }))
vi.mock('../data/store', () => ({ useStore: () => ({ ...mocks, profile: {},
  meals: [{ id: 'meal', name: 'Rice', date: '2026-09-15', type: 'lunch', calories: 130, protein: 3, carbs: 28, fat: 1, createdAt: '' }],
  workouts: [{ id: 'workout', date: '2026-09-15', type: 'walk', durationMin: 30, calories: 100, createdAt: '' }],
}) }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ lang: 'en', t: (key: string) => key }) }))
vi.mock('../components/ProgressRing', () => ({ default: () => null }))
vi.mock('../components/MacroBar', () => ({ default: () => null }))
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(['meal', 'workout'] as const)('confirms %s deletion and reports failure without removing the record', async kind => {
  const remove = kind === 'meal' ? mocks.deleteMeal : mocks.deleteWorkout
  remove.mockRejectedValue(new Error('offline'))
  render(<MemoryRouter initialEntries={['/day/2026-09-15']}><Routes><Route path="/day/:date" element={<Day />} /></Routes></MemoryRouter>)
  const button = screen.getByLabelText(kind === 'meal' ? 'Delete Rice' : 'Delete workout.type.walk')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  fireEvent.click(button)
  expect(remove).not.toHaveBeenCalled()
  fireEvent.click(button); fireEvent.click(button)
  await screen.findByRole('alert')
  expect(remove).toHaveBeenCalledExactlyOnceWith(kind)
  expect(screen.getByText('Rice')).toBeTruthy()
  fireEvent.click(button)
  await screen.findByRole('alert')
  expect(remove).toHaveBeenCalledTimes(2)
})
