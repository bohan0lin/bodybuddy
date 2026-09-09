// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ActionProposalCard from './ActionProposalCard'
import { ProposalConflict } from '../lib/confirmProposal'
import type { ActionProposal } from '../../api/_lib/contracts'

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('../lib/confirmProposal', () => ({ confirmProposal: (...args: unknown[]) => mocks.confirm(...args), ProposalConflict: class extends Error {} }))
vi.mock('../lib/i18n', () => ({ useT: () => ({ t: (key: string) => key }) }))
const proposal: ActionProposal = { actionId: '10000000-0000-4000-8000-000000000001', date: '2026-09-09', action: { type: 'log', name: 'Rice', mealType: 'lunch', amount: 100, unit: 'g', protein: 3, carbs: 28, fat: 1, calories: 130 } }
beforeEach(() => { vi.clearAllMocks(); mocks.confirm.mockResolvedValue({ recordId: proposal.actionId, replayed: false }) })
afterEach(cleanup)

it('does not write before confirmation and saves edited fields', async () => {
  render(<ActionProposalCard proposal={proposal} onSaved={vi.fn()} />)
  expect(mocks.confirm).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('proposal.name'), { target: { value: 'Brown rice' } })
  fireEvent.change(screen.getByLabelText('proposal.calories'), { target: { value: '150' } })
  fireEvent.click(screen.getByText('proposal.confirm'))
  await screen.findByText('proposal.saved')
  expect(mocks.confirm).toHaveBeenCalledWith({ ...proposal, action: { ...proposal.action, name: 'Brown rice', calories: 150 } })
})
it('cancels without writing or presenting a saved state', () => {
  render(<ActionProposalCard proposal={proposal} onSaved={vi.fn()} />)
  fireEvent.click(screen.getByText('proposal.cancel'))
  expect(screen.getByText('proposal.cancelled')).toBeTruthy()
  expect(screen.queryByText('proposal.saved')).toBeNull()
  expect(mocks.confirm).not.toHaveBeenCalled()
})
it('locks repeat submissions while a write is pending', () => {
  mocks.confirm.mockReturnValue(new Promise(() => {}))
  render(<ActionProposalCard proposal={proposal} onSaved={vi.fn()} />)
  const confirm = screen.getByText('proposal.confirm')
  fireEvent.click(confirm); fireEvent.click(confirm)
  expect(mocks.confirm).toHaveBeenCalledOnce()
  expect(screen.getByText('proposal.saving')).toBeTruthy()
})
it('retries uncertain writes using the same frozen payload and actionId', async () => {
  mocks.confirm.mockRejectedValueOnce(new Error('timeout'))
  const saved = vi.fn()
  render(<ActionProposalCard proposal={proposal} onSaved={saved} />)
  fireEvent.click(screen.getByText('proposal.confirm'))
  await screen.findByRole('alert')
  expect(saved).not.toHaveBeenCalled()
  expect(screen.getByLabelText('proposal.name').matches(':disabled')).toBe(true)
  fireEvent.click(screen.getByText('common.retry'))
  await screen.findByText('proposal.saved')
  expect(mocks.confirm.mock.calls[0]).toEqual(mocks.confirm.mock.calls[1])
  expect(saved).toHaveBeenCalledOnce()
})
it('blocks conflicting retries and tells the user to review the existing record', async () => {
  mocks.confirm.mockRejectedValue(new ProposalConflict())
  render(<ActionProposalCard proposal={proposal} onSaved={vi.fn()} />)
  fireEvent.click(screen.getByText('proposal.confirm'))
  await screen.findByText('proposal.conflict')
  expect(screen.queryByText('common.retry')).toBeNull()
})
it('prevents invalid numeric edits from being submitted', () => {
  render(<ActionProposalCard proposal={proposal} onSaved={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('proposal.calories'), { target: { value: '-1' } })
  expect((screen.getByText('proposal.confirm') as HTMLButtonElement).disabled).toBe(true)
})
