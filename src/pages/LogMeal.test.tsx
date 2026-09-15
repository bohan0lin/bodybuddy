// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LogMeal, { FoodEntryEditor } from './LogMeal'
import { setPendingPhoto } from '../lib/photoHandoff'

const mocks = vi.hoisted(() => ({ record: vi.fn(), upload: vi.fn(), api: vi.fn(), reload: vi.fn(), updateSavedItem: vi.fn(), deleteSavedItem: vi.fn(), t: (key: string) => key, saved: [] as unknown[] }))
vi.mock('../data/store', () => ({ useStore: () => ({ savedItems: mocks.saved, reload: mocks.reload, updateSavedItem: mocks.updateSavedItem, deleteSavedItem: mocks.deleteSavedItem }) }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ lang: 'en', t: mocks.t }) }))
vi.mock('../lib/api', () => ({ postJson: (...args: unknown[]) => mocks.api(...args) }))
vi.mock('../lib/image', () => ({ fileToResizedBase64: async () => ({ data: 'abc', mediaType: 'image/jpeg' }) }))
vi.mock('../components/FoodPhoto', () => ({ default: ({ path, alt }: { path: string; alt: string }) => path ? <img src={path} alt={alt} /> : <span>No photo</span> }))
vi.mock('../lib/foodEntry', async (original) => ({ ...await original<object>(), recordFoodEntry: (...args: unknown[]) => mocks.record(...args), uploadFoodPhoto: (...args: unknown[]) => mocks.upload(...args) }))

const food = { name: 'Rice', amount: 100, unit: 'g', protein: 3, carbs: 28, fat: 1, calories: 130 }
beforeEach(() => { vi.resetAllMocks(); mocks.saved = []; mocks.record.mockResolvedValue(undefined); mocks.upload.mockResolvedValue('user/photo.jpg') })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('food entry', () => {
  it('retains a failed favorite edit and freezes its exact retry', async () => {
    mocks.updateSavedItem.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    const done = vi.fn()
    const favorite = { ...food, id: 'favorite', kind: 'food' as const, baseAmount: 100 }
    render(<FoodEntryEditor initial={food} editSaved={favorite} onDone={done} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } })
    fireEvent.click(screen.getByText('Save changes'))
    await screen.findByRole('alert')
    expect(done).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Amount') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByText('Change favorite photo') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText('Save changes'))
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(mocks.updateSavedItem.mock.calls[1]).toEqual(mocks.updateSavedItem.mock.calls[0])
    expect(mocks.updateSavedItem.mock.calls[1]).toEqual(['favorite', expect.objectContaining({ baseAmount: 200, calories: 260 })])
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('confirms favorite deletion and retains the editor after failure', async () => {
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    mocks.deleteSavedItem.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
    const done = vi.fn()
    const favorite = { ...food, id: 'favorite', kind: 'food' as const, baseAmount: 100 }
    render(<FoodEntryEditor initial={food} editSaved={favorite} onDone={done} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('Remove favorite'))
    expect(mocks.deleteSavedItem).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Remove favorite'))
    await screen.findByRole('alert')
    expect(done).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Remove favorite'))
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
  })

  it('waits for meal acknowledgement and ignores rapid duplicate saves', async () => {
    let finish!: () => void
    mocks.record.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const done = vi.fn()
    render(<FoodEntryEditor initial={food} onDone={done} onCancel={vi.fn()} />)
    const save = screen.getByText('Log meal')
    fireEvent.click(save); fireEvent.click(save)
    expect(mocks.record).toHaveBeenCalledOnce()
    expect(done).not.toHaveBeenCalled()
    finish()
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
  })

  it('keeps a failed meal edit on screen and retries the same record', async () => {
    mocks.record.mockRejectedValueOnce(new Error('offline'))
    const done = vi.fn()
    const meal = { ...food, id: 'existing', type: 'lunch' as const, date: '2026-09-15', createdAt: '' }
    render(<FoodEntryEditor initial={food} editMeal={meal} onDone={done} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } })
    fireEvent.click(screen.getByText('Save changes'))
    await screen.findByRole('alert')
    expect(done).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Save changes'))
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(mocks.record.mock.calls[0]).toEqual(mocks.record.mock.calls[1])
    expect(mocks.record.mock.calls[1]).toEqual(['existing', expect.objectContaining({ amount: 200, calories: 260 }), false])
  })

  it('shows only favorites in quick entry and scales their nutrition and photo', async () => {
    mocks.saved = [{ ...food, id: 'favorite', baseAmount: 100, kind: 'food', photoUrl: 'user/original.jpg' }]
    render(<MemoryRouter initialEntries={['/log']}><LogMeal /></MemoryRouter>)
    expect(screen.queryByText('Take / choose photo')).toBeNull()
    expect(screen.queryByText('Food name')).toBeNull()
    fireEvent.click(screen.getByText('Rice'))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } })
    fireEvent.click(screen.getByText('Log meal'))
    await waitFor(() => expect(mocks.record).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ calories: 260, amount: 200, photoUrl: 'user/original.jpg' }), false))
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('keeps a failed save on screen and retries with the same ID and uploaded image', async () => {
    mocks.record.mockRejectedValueOnce(new Error('offline'))
    const done = vi.fn()
    render(<FoodEntryEditor initial={food} photo="data:image/jpeg;base64,abc" onDone={done} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Save to favorites with photo'))
    fireEvent.click(screen.getByText('Log meal'))
    await screen.findByRole('alert')
    expect(done).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Amount') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByText('Calibrate') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Save to favorites with photo') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByText('Log meal'))
    await waitFor(() => expect(done).toHaveBeenCalledOnce())
    expect(mocks.upload).toHaveBeenCalledOnce()
    expect(mocks.record.mock.calls[0]).toEqual(mocks.record.mock.calls[1])
    expect(mocks.record.mock.calls[1][2]).toBe(true)
  })

  it('reviews all foods from a photo instead of recording only the first item', async () => {
    mocks.api.mockResolvedValue({ items: [food, { ...food, name: 'Chicken', calories: 200 }] })
    setPendingPhoto(new File(['image'], 'meal.jpg', { type: 'image/jpeg' }))
    render(<MemoryRouter initialEntries={['/capture']}><LogMeal /></MemoryRouter>)
    await screen.findByText('Rice + Chicken')
    expect(screen.getByText('330')).toBeTruthy()
    expect(screen.getByAltText('Rice + Chicken').getAttribute('src')).toContain('data:image/jpeg')
    expect(mocks.record).not.toHaveBeenCalled()
  })

  it('retains a failed recognition photo for calibration without another AI request', async () => {
    mocks.api.mockRejectedValue(new Error('Recognition unavailable'))
    setPendingPhoto(new File(['image'], 'meal.jpg', { type: 'image/jpeg' }))
    render(<MemoryRouter initialEntries={['/capture']}><LogMeal /></MemoryRouter>)
    await screen.findByText('Recognition unavailable')
    fireEvent.click(screen.getByText('Enter nutrition'))
    expect(screen.getByText('Calibrate nutrition')).toBeTruthy()
    expect(screen.getByAltText('Food photo')).toBeTruthy()
    expect(mocks.api).toHaveBeenCalledOnce()
  })

  it('requires valid calibration before recording and preserves explicit zero calories', async () => {
    render(<FoodEntryEditor initial={food} onDone={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('Calibrate'))
    fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '0' } })
    fireEvent.click(screen.getByText('Apply calibration'))
    fireEvent.click(screen.getByText('Log meal'))
    await waitFor(() => expect(mocks.record).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ calories: 0 }), false))
  })
})
