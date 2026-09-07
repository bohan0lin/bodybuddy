// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Body from './Body'
import SettingsProfile from './SettingsProfile'
import { todayStr } from '../lib/nutrition'

const mocks = vi.hoisted(() => ({ updateProfile: vi.fn(), upsertWeight: vi.fn() }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))
vi.mock('../data/store', () => ({ useStore: () => ({
  profile: { displayName: 'Test', heightCm: 170 },
  weightLogs: [{ id: 'old', date: '2020-01-01', weight: 65, bodyFat: 19 }],
  ...mocks,
}) }))
beforeEach(() => { vi.clearAllMocks(); mocks.updateProfile.mockResolvedValue(undefined); mocks.upsertWeight.mockResolvedValue(undefined) })
afterEach(cleanup)
function mount() { render(<MemoryRouter><Body /></MemoryRouter>) }

it('saves height, weight and body fat together', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('settings.heightCm'), { target: { value: '175' } })
  fireEvent.change(screen.getByLabelText('body.weightKg'), { target: { value: '70' } })
  fireEvent.change(screen.getByLabelText('body.bodyFatOpt'), { target: { value: '20' } })
  fireEvent.click(screen.getByText('common.save'))
  await screen.findByRole('status')
  expect(mocks.updateProfile).toHaveBeenCalledWith({ heightCm: 175 })
  expect(mocks.upsertWeight).toHaveBeenCalledWith({ date: todayStr(), weight: 70, bodyFat: 20 })
})

it('allows a height-only update without creating a weight record', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('settings.heightCm'), { target: { value: '175' } })
  fireEvent.click(screen.getByText('common.save'))
  await screen.findByRole('status')
  expect(mocks.upsertWeight).not.toHaveBeenCalled()
})

it('loads an existing date and preserves its weight when changing body fat', async () => {
  mount()
  fireEvent.change(screen.getByLabelText('body.date'), { target: { value: '2020-01-01' } })
  expect((screen.getByLabelText('body.weightKg') as HTMLInputElement).value).toBe('65')
  fireEvent.change(screen.getByLabelText('body.bodyFatOpt'), { target: { value: '18' } })
  fireEvent.click(screen.getByText('common.save'))
  await screen.findByRole('status')
  expect(mocks.upsertWeight).toHaveBeenCalledWith({ date: '2020-01-01', weight: 65, bodyFat: 18 })
  expect(mocks.updateProfile).not.toHaveBeenCalled()
})

it('keeps entered measurements after a failed save and supports retry', async () => {
  mocks.upsertWeight.mockRejectedValueOnce(new Error('offline'))
  mount()
  fireEvent.change(screen.getByLabelText('body.weightKg'), { target: { value: '70' } })
  fireEvent.click(screen.getByText('common.save'))
  await screen.findByRole('alert')
  expect(screen.queryByRole('status')).toBeNull()
  expect((screen.getByLabelText('body.weightKg') as HTMLInputElement).value).toBe('70')
  fireEvent.click(screen.getByText('common.save'))
  await screen.findByRole('status')
  expect(mocks.upsertWeight).toHaveBeenCalledTimes(2)
})

it('rejects body fat without weight and out-of-range measurements', () => {
  mount()
  fireEvent.change(screen.getByLabelText('body.bodyFatOpt'), { target: { value: '18' } })
  expect((screen.getByText('common.save') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('body.weightKg'), { target: { value: '70' } })
  fireEvent.change(screen.getByLabelText('body.bodyFatOpt'), { target: { value: '101' } })
  expect((screen.getByText('common.save') as HTMLButtonElement).disabled).toBe(true)
})

it('edits only the name in the profile and exposes the unified metrics entry', async () => {
  render(<MemoryRouter><SettingsProfile /></MemoryRouter>)
  expect(screen.queryByText('settings.heightCm')).toBeNull()
  expect(screen.getByText('me.bodyMetrics', { exact: false })).toBeTruthy()
  fireEvent.click(screen.getByText('settings.saveTargets'))
  await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledWith({ displayName: 'Test' }))
})
