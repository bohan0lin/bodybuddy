// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import DailySummaryCarousel from './DailySummaryCarousel'

vi.mock('../lib/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)

it('switches accessible faces and disables the hidden action even without inert support', () => {
  const onLogWorkout = vi.fn()
  const macros = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const { container } = render(<DailySummaryCarousel targets={macros} consumed={macros} todayWorkouts={[]} onLogWorkout={onLogWorkout} />)
  const faces = container.querySelectorAll('article')
  const action = screen.getByText('nav.logWorkout') as HTMLButtonElement
  expect(faces[1].hasAttribute('inert')).toBe(true)
  expect(faces[1].getAttribute('aria-hidden')).toBe('true')
  expect(action.disabled).toBe(true)
  expect(action.tabIndex).toBe(-1)
  fireEvent.click(action)
  expect(onLogWorkout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'today.workout' }))
  expect(faces[0].hasAttribute('inert')).toBe(true)
  expect(faces[1].hasAttribute('inert')).toBe(false)
  expect(action.disabled).toBe(false)
  expect(action.tabIndex).toBe(0)
  fireEvent.click(action)
  expect(onLogWorkout).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'today.remaining' }))
  expect(action.disabled).toBe(true)
})
