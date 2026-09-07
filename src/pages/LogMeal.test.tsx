// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LogMeal, { FoodEntryEditor } from './LogMeal'
import { setPendingPhoto } from '../lib/photoHandoff'

const mocks = vi.hoisted(() => ({ record: vi.fn(), upload: vi.fn(), api: vi.fn(), reload: vi.fn(), t: (key: string) => key, saved: [] as unknown[] }))
vi.mock('../data/store', () => ({ useStore: () => ({ savedItems: mocks.saved, reload: mocks.reload }) }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ lang: 'en', t: mocks.t }) }))
vi.mock('../lib/api', () => ({ postJson: (...args: unknown[]) => mocks.api(...args) }))
vi.mock('../lib/image', () => ({ fileToResizedBase64: async () => ({ data: 'abc', mediaType: 'image/jpeg' }) }))
vi.mock('../components/FoodPhoto', () => ({ default: ({ path, alt }: { path: string; alt: string }) => path ? <img src={path} alt={alt} /> : <span>No photo</span> }))
vi.mock('../lib/foodEntry', async (original) => ({ ...await original<object>(), recordFoodEntry: (...args: unknown[]) => mocks.record(...args), uploadFoodPhoto: (...args: unknown[]) => mocks.upload(...args) }))

const food = { name: 'Rice', amount: 100, unit: 'g', protein: 3, carbs: 28, fat: 1, calories: 130 }
beforeEach(() => { vi.clearAllMocks(); mocks.saved = []; mocks.record.mockResolvedValue(undefined); mocks.upload.mockResolvedValue('user/photo.jpg') })
afterEach(cleanup)

describe('food entry', () => {
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
