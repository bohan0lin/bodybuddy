import { z } from 'zod'
import { proposalSchema, type ActionProposal } from '../../api/_lib/contracts'
import { supabase } from './supabase'
import { ProposalConflict } from './confirmProposal'

export const coachHistoryEnabled = import.meta.env.VITE_COACH_HISTORY_ENABLED === 'true'
export interface ProposalState {
  proposal: ActionProposal
  version: number
  status: 'pending' | 'confirmed' | 'cancelled'
  expiresAt: string
}
export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  image?: string
  replyTo?: string
  actions?: ActionProposal[]
  states?: ProposalState[]
}
const stateSchema = z.object({ action_id: z.uuid(), payload: z.object({ date: z.string(), action: z.unknown() }), version: z.number().int().positive(), status: z.enum(['pending', 'confirmed', 'cancelled']), expires_at: z.string() })
export function parseProposalState(value: unknown): ProposalState {
  const row = stateSchema.parse(value)
  return { proposal: proposalSchema.parse({ actionId: row.action_id, ...row.payload }), version: row.version, status: row.status, expiresAt: row.expires_at }
}

export async function loadCoachHistory(owner: string, signal?: AbortSignal): Promise<CoachMessage[]> {
  const query = supabase.from('coach_messages').select('*').eq('user_id', owner).order('sequence', { ascending: false }).limit(40)
  const { data, error } = await query.abortSignal(signal ?? AbortSignal.timeout(15000))
  if (error) throw new Error('Conversation history unavailable')
  if (!data.length) return []
  const proposals = await supabase.from('coach_proposals').select('*').eq('user_id', owner).in('message_id', data.map(row => row.id)).abortSignal(signal ?? AbortSignal.timeout(15000))
  if (proposals.error) throw new Error('Proposal history unavailable')
  return data.reverse().map(row => {
    const body = z.object({ text: z.string(), image: z.string().optional() }).parse(row.body)
    const states = proposals.data.filter(proposal => proposal.message_id === row.id).map(parseProposalState)
    return { id: row.id, role: z.enum(['user', 'assistant']).parse(row.role), ...body, replyTo: row.reply_to ?? undefined, actions: states.map(state => state.proposal), states }
  })
}

export async function appendCoachMessage(owner: string, message: CoachMessage) {
  const { error } = await supabase.rpc('append_coach_message', {
    p_owner: owner, p_id: message.id, p_role: message.role,
    p_body: { text: message.text, ...(message.image ? { image: message.image } : {}) },
    ...(message.replyTo ? { p_reply_to: message.replyTo } : {}),
    p_proposals: (message.actions ?? []).map(proposal => proposalSchema.parse(proposal)),
  }).abortSignal(AbortSignal.timeout(15000))
  if (error?.code === '23505' && message.role === 'assistant' && message.replyTo) {
    // Another device may have completed the same interrupted turn first.
    // Load that canonical reply instead of ever presenting unregistered actions.
    const existing = await supabase.from('coach_messages').select('id').eq('user_id', owner).eq('reply_to', message.replyTo).abortSignal(AbortSignal.timeout(15000)).maybeSingle()
    if (!existing.error && existing.data) return
  }
  if (error) throw new Error('Conversation could not be saved')
}

export async function transitionCoachProposal(owner: string, state: ProposalState, operation: 'edit' | 'cancel' | 'confirm', proposal: ActionProposal): Promise<ProposalState> {
  const { actionId, ...payload } = proposalSchema.parse(proposal)
  if (actionId !== state.proposal.actionId) throw new ProposalConflict('Proposal identity changed')
  const { data, error } = await supabase.rpc('transition_coach_proposal', {
    p_owner: owner, p_action_id: actionId, p_version: state.version, p_operation: operation, p_payload: payload,
  }).abortSignal(AbortSignal.timeout(15000))
  if (error?.code === 'PT409' || error?.code === 'PT410') throw new ProposalConflict('Proposal changed, expired or is no longer pending')
  if (error) throw new Error('Proposal state could not be confirmed')
  return parseProposalState(data)
}
