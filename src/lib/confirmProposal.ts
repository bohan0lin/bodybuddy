import { z } from 'zod'
import { proposalSchema, type ActionProposal } from '../../api/_lib/contracts'
import { supabase } from './supabase'

export class ProposalConflict extends Error {}
const receiptSchema = z.object({ recordId: z.uuid(), replayed: z.boolean() })

export async function confirmProposal(proposal: ActionProposal) {
  const { actionId, ...payload } = proposalSchema.parse(proposal)
  const { data, error } = await supabase.rpc('confirm_agent_action', { p_action_id: actionId, p_payload: payload })
  if (error?.code === 'PT409') throw new ProposalConflict('Action content conflicts with its saved receipt.')
  if (error) throw new Error('Could not confirm the proposal.')
  return receiptSchema.parse(data)
}
