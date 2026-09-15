// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import LogWorkout from './LogWorkout'
import { RecordConflict } from '../lib/recordMutations'

const mocks = vi.hoisted(() => ({ addWorkout: vi.fn(), updateWorkout: vi.fn(), deleteWorkout: vi.fn() }))
vi.mock('../data/store', () => ({ useStore: () => ({ ...mocks, latestWeight: { weight: 70 } }) }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ lang: 'en', t: (key: string) => key }) }))
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function mount(edit = false) {
  render(<MemoryRouter initialEntries={[{ pathname: '/workout', state: { returnTo: '/done', editWorkout: edit ? { id: 'existing', date: '2026-09-15', type: 'walk', durationMin: 30, calories: 100, note: 'Old note' } : undefined } }]}>
    <Routes><Route path="/workout" element={<LogWorkout />} /><Route path="/done" element={<p>Returned</p>} /></Routes>
  </MemoryRouter>)
  if (!edit) fireEvent.change(screen.getByLabelText('workout.duration'), { target: { value: '30' } })
}

it('waits for acknowledgement and prevents double submission', async () => {
  let finish!: () => void
  mocks.addWorkout.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  mount()
  const save = screen.getByText('workout.save')
  fireEvent.click(save); fireEvent.click(save)
  expect(mocks.addWorkout).toHaveBeenCalledOnce()
  expect(screen.queryByText('Returned')).toBeNull()
  expect((screen.getByText('common.cancel') as HTMLButtonElement).disabled).toBe(true)
  await act(async () => { finish() })
  expect(screen.getByText('Returned')).toBeTruthy()
})

it('keeps failed creates on screen and retries the original ID and values', async () => {
  mocks.addWorkout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  mount()
  fireEvent.click(screen.getByText('workout.save'))
  await screen.findByRole('alert')
  expect(screen.queryByText('Returned')).toBeNull()
  expect(screen.getByLabelText('workout.duration').closest('fieldset')?.disabled).toBe(true)
  fireEvent.click(screen.getByText('common.retry'))
  await screen.findByText('Returned')
  expect(mocks.addWorkout.mock.calls[1]).toEqual(mocks.addWorkout.mock.calls[0])
})

it('reports content conflicts without permitting another write', async () => {
  mocks.addWorkout.mockRejectedValue(new RecordConflict())
  mount()
  fireEvent.click(screen.getByText('workout.save'))
  expect((await screen.findByRole('alert')).textContent).toContain('different saved content')
  expect((screen.getByText('common.retry') as HTMLButtonElement).disabled).toBe(true)
})

it('keeps edits after a failed update and waits for a successful retry', async () => {
  mocks.updateWorkout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  mount(true)
  fireEvent.change(screen.getByLabelText('workout.note'), { target: { value: '' } })
  fireEvent.click(screen.getByText('workout.update'))
  await screen.findByRole('alert')
  expect(mocks.updateWorkout).toHaveBeenCalledWith('existing', expect.objectContaining({ note: '' }))
  fireEvent.click(screen.getByText('common.retry'))
  await screen.findByText('Returned')
})

it('confirms deletion and keeps a failed deletion retryable', async () => {
  mocks.deleteWorkout.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  mount(true)
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  fireEvent.click(screen.getByText('workout.delete'))
  expect(mocks.deleteWorkout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('workout.delete'))
  await screen.findByRole('alert')
  expect(screen.queryByText('Returned')).toBeNull()
  fireEvent.click(screen.getByText('workout.delete'))
  await screen.findByText('Returned')
})

it('rejects negative burn and impossible duration without a database call', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('workout.burn'), { target: { value: '-1' } })
  fireEvent.click(screen.getByText('workout.save'))
  expect(mocks.addWorkout).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('workout.burn'), { target: { value: '0' } })
  fireEvent.change(screen.getByLabelText('workout.duration'), { target: { value: '1441' } })
  expect((screen.getByText('workout.save') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('workout.duration'), { target: { value: '30' } })
  fireEvent.click(screen.getByText('workout.save'))
  await waitFor(() => expect(mocks.addWorkout).toHaveBeenCalledWith(expect.objectContaining({ calories: 0 }), expect.any(String)))
})
