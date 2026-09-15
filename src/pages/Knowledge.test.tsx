// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Knowledge from './Knowledge'
import { RecordConflict } from '../lib/recordMutations'

const mocks = vi.hoisted(() => ({ addKnowledge: vi.fn(), updateKnowledge: vi.fn(), deleteKnowledge: vi.fn(), api: vi.fn(), items: [] as { id: string; title: string; content: string }[] }))
vi.mock('../data/store', () => ({ useStore: () => ({ ...mocks, knowledgeItems: mocks.items }) }))
vi.mock('../lib/api', () => ({ postJson: (...args: unknown[]) => mocks.api(...args) }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ lang: 'en', t: (key: string) => key }) }))
const draft = { relevant: true, title: 'Recovery', content: 'Rest between sessions.', tags: 'training' }
beforeEach(() => { vi.resetAllMocks(); mocks.items = []; mocks.api.mockResolvedValue(draft); vi.spyOn(window, 'confirm').mockReturnValue(true) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function mount() { render(<MemoryRouter><Knowledge /></MemoryRouter>) }
async function prepare() {
  fireEvent.change(screen.getByPlaceholderText('knowledge.inputPh'), { target: { value: 'Rest after training' } })
  fireEvent.click(screen.getByText('knowledge.tidy'))
  await screen.findByText('knowledge.confirm')
}

it('keeps the preview until acknowledgement and prevents duplicate clicks', async () => {
  let finish!: () => void
  mocks.addKnowledge.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
  mount(); await prepare()
  const save = screen.getByText('knowledge.confirm')
  fireEvent.click(save); fireEvent.click(save)
  expect(mocks.addKnowledge).toHaveBeenCalledOnce()
  expect(screen.getByText(draft.content)).toBeTruthy()
  await act(async () => finish())
  expect(screen.queryByText(draft.content)).toBeNull()
  expect((screen.getByPlaceholderText('knowledge.inputPh') as HTMLTextAreaElement).value).toBe('')
})

it('retries a failed draft with the same ID and content without another model call', async () => {
  mocks.addKnowledge.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  mount(); await prepare()
  fireEvent.click(screen.getByText('knowledge.confirm'))
  await screen.findByRole('alert')
  expect(screen.getByText(draft.content)).toBeTruthy()
  expect((screen.getByText('knowledge.discard') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByText('common.retry'))
  await waitFor(() => expect(screen.queryByText('common.retry')).toBeNull())
  expect(mocks.addKnowledge.mock.calls[1]).toEqual(mocks.addKnowledge.mock.calls[0])
  expect(mocks.api).toHaveBeenCalledOnce()
})

it('discloses replacement and retries an update against the original target', async () => {
  mocks.items = [{ id: 'existing', title: draft.title, content: 'Old content' }]
  mocks.updateKnowledge.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined)
  mount(); await prepare()
  expect(screen.getByText('Confirming will replace the existing item with this title.')).toBeTruthy()
  fireEvent.click(screen.getByText('knowledge.confirm'))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByText('common.retry'))
  await waitFor(() => expect(mocks.updateKnowledge).toHaveBeenCalledTimes(2))
  expect(mocks.updateKnowledge.mock.calls[0]).toEqual(['existing', { title: draft.title, content: draft.content, tags: draft.tags }])
  expect(mocks.addKnowledge).not.toHaveBeenCalled()
})

it('blocks a conflicting create retry', async () => {
  mocks.addKnowledge.mockRejectedValue(new RecordConflict())
  mount(); await prepare()
  fireEvent.click(screen.getByText('knowledge.confirm'))
  expect((await screen.findByRole('alert')).textContent).toContain('different saved content')
  expect((screen.getByText('common.retry') as HTMLButtonElement).disabled).toBe(true)
})

it('discards without writing and confirms deletion before attempting it', async () => {
  mocks.items = [{ id: 'existing', title: 'Saved', content: 'Saved content' }]
  mocks.deleteKnowledge.mockRejectedValue(new Error('offline'))
  mount(); await prepare()
  fireEvent.click(screen.getByText('knowledge.discard'))
  expect(mocks.addKnowledge).not.toHaveBeenCalled()
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  fireEvent.click(screen.getByLabelText('Delete Saved'))
  expect(mocks.deleteKnowledge).not.toHaveBeenCalled()
  fireEvent.click(screen.getByLabelText('Delete Saved'))
  await screen.findByRole('alert')
  expect(screen.getByText('Saved content')).toBeTruthy()
  fireEvent.click(screen.getByLabelText('Delete Saved'))
  await waitFor(() => expect(mocks.deleteKnowledge).toHaveBeenCalledTimes(2))
})
