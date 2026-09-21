// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Coach from './Coach'

const mocks = vi.hoisted(() => ({ load: vi.fn(), append: vi.fn(), transition: vi.fn(), post: vi.fn(), refresh: vi.fn() }))
vi.mock('../lib/coachHistory', () => ({ coachHistoryEnabled: true, loadCoachHistory: mocks.load, appendCoachMessage: mocks.append, transitionCoachProposal: mocks.transition }))
vi.mock('../data/auth', () => ({ useAuth: () => ({ session: { user: { id: 'owner' } } }) }))
vi.mock('../data/store', () => ({ useStore: () => ({ refreshRecords: mocks.refresh }) }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ lang: 'en', t: (key: string) => key }) }))
vi.mock('../lib/api', () => ({ postJson: mocks.post, ApiRequestError: class extends Error {} }))
vi.mock('../lib/confirmProposal', () => ({ confirmProposal: vi.fn(), ProposalConflict: class extends Error {} }))
const history = [{ id: 'message', role: 'assistant', text: 'Recovered conversation' }]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.load.mockResolvedValue([])
  mocks.append.mockResolvedValue(undefined)
  mocks.post.mockResolvedValue({ reply: 'Reply', actions: [] })
})
afterEach(cleanup)
const show = () => render(<MemoryRouter><Coach /></MemoryRouter>)

it('restores server history when the page is reopened', async () => {
  mocks.load.mockResolvedValue(history)
  const first = show()
  await screen.findByText('Recovered conversation')
  first.unmount()
  show()
  await screen.findByText('Recovered conversation')
  expect(mocks.load).toHaveBeenCalledTimes(2)
  expect(mocks.post).not.toHaveBeenCalled()
})

it('blocks new requests until history is successfully loaded', async () => {
  mocks.load.mockRejectedValueOnce(new Error('offline'))
  show()
  await screen.findByText('coach.historyError')
  fireEvent.change(screen.getByPlaceholderText('assistant.placeholder'), { target: { value: 'Hello' } })
  fireEvent.click(screen.getByText('↑'))
  expect(mocks.post).not.toHaveBeenCalled()
  mocks.load.mockResolvedValue(history)
  fireEvent.click(screen.getByText('common.retry'))
  await screen.findByText('Recovered conversation')
})

it('retries the same assistant message after an uncertain persistence result without regenerating', async () => {
  show()
  await waitFor(() => expect(screen.queryByText('coach.historyLoading')).toBeNull())
  mocks.append.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('response lost')).mockResolvedValue(undefined)
  fireEvent.change(screen.getByPlaceholderText('assistant.placeholder'), { target: { value: 'Hello' } })
  fireEvent.click(screen.getByText('↑'))
  await screen.findByText('coach.persistError')
  expect(mocks.append).toHaveBeenCalledTimes(2)
  const pending = mocks.append.mock.calls[1][1]
  mocks.load.mockResolvedValue([{ ...pending }])
  fireEvent.click(screen.getByText('common.retry'))
  await screen.findByText('Reply')
  expect(mocks.append.mock.calls[2][1]).toEqual(pending)
  expect(mocks.post).toHaveBeenCalledOnce()
})
