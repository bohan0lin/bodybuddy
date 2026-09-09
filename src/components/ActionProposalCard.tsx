import { useRef, useState } from 'react'
import { proposalSchema, type ActionProposal } from '../../api/_lib/contracts'
import { confirmProposal, ProposalConflict } from '../lib/confirmProposal'
import { useT } from '../lib/i18n'

export default function ActionProposalCard({ proposal, onSaved }: { proposal: ActionProposal; onSaved: () => void }) {
  const { t } = useT()
  const [draft, setDraft] = useState(proposal)
  const [status, setStatus] = useState<'review' | 'saving' | 'saved' | 'cancelled' | 'error' | 'conflict'>('review')
  const submitted = useRef<ActionProposal | null>(null)
  const busy = useRef(false)
  const a = draft.action
  const locked = status !== 'review'
  const valid = proposalSchema.safeParse(draft).success

  function edit(key: string, value: string | number) {
    setDraft((current) => ({ ...current, action: { ...current.action, [key]: value } }))
  }
  async function save() {
    if (busy.current || !valid || !['review', 'error'].includes(status)) return
    // Freeze the confirmed payload across uncertain network outcomes; never retry edited content.
    submitted.current ??= proposalSchema.parse(draft)
    busy.current = true
    setStatus('saving')
    try {
      await confirmProposal(submitted.current)
    } catch (error) {
      setStatus(error instanceof ProposalConflict ? 'conflict' : 'error')
      return
    } finally { busy.current = false }
    setStatus('saved')
    onSaved()
  }
  const numeric = (key: string, label: string, value: number | undefined, optional = false) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <input type="number" inputMode="decimal" step="any" value={Number.isNaN(value) ? '' : value ?? ''} disabled={locked}
        onChange={(event) => {
          if (!event.target.value && optional) {
            setDraft((current) => { const action = { ...current.action }; delete (action as Record<string, unknown>)[key]; return { ...current, action } })
          } else edit(key, event.target.value ? Number(event.target.value) : NaN)
        }} />
    </label>
  )
  return (
    <section className="card proposal-card" aria-label={t('proposal.title')}>
      <p className="card-label">{t(a.type === 'log' ? 'assistant.logAction' : a.type === 'save' ? 'assistant.saveAction' : 'workout.title')}</p>
      <p className="muted" style={{ fontSize: 12 }}>{t('proposal.estimate')}</p>
      <fieldset disabled={locked} style={{ padding: 0, margin: 0, border: 0, minWidth: 0 }}>
        {a.type !== 'save' && <label className="field"><span>{t('body.date')}</span><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>}
        {a.type === 'workout' ? <>
          <label className="field"><span>{t('proposal.workoutType')}</span><select value={a.workoutType} onChange={(e) => edit('workoutType', e.target.value)}>
            {['strength','run','hiit','cycling','ball','swim','walk','yoga','other'].map(type => <option key={type} value={type}>{t(`workout.type.${type}`)}</option>)}
          </select></label>
          <label className="field"><span>{t('proposal.note')}</span><input value={a.note ?? ''} maxLength={1000} onChange={(e) => edit('note', e.target.value)} /></label>
          {numeric('durationMin', t('proposal.duration'), a.durationMin)}
        </> : <>
          <label className="field"><span>{t('proposal.name')}</span><input value={a.name} maxLength={200} onChange={(e) => edit('name', e.target.value)} /></label>
          <label className="field"><span>{t('proposal.brand')}</span><input value={a.brand ?? ''} maxLength={200} onChange={(e) => {
            setDraft(current => { const action = { ...current.action }; if (action.type !== 'workout') { if (e.target.value) action.brand = e.target.value; else delete action.brand } return { ...current, action } })
          }} /></label>
          {a.type === 'log' ? <label className="field"><span>{t('proposal.mealType')}</span><select value={a.mealType} onChange={(e) => edit('mealType', e.target.value)}>{['breakfast','lunch','dinner','snack'].map(type => <option key={type} value={type}>{t(`meal.${type}`)}</option>)}</select></label>
            : <label className="field"><span>{t('proposal.kind')}</span><select value={a.kind} onChange={(e) => edit('kind', e.target.value)}><option value="food">{t('proposal.food')}</option><option value="meal">{t('proposal.meal')}</option></select></label>}
          <div className="row">{numeric(a.type === 'log' ? 'amount' : 'baseAmount', t('proposal.amount'), a.type === 'log' ? a.amount : a.baseAmount, a.type === 'log')}
            <label className="field"><span>{t('proposal.unit')}</span><input value={a.unit ?? ''} maxLength={30} onChange={(e) => edit('unit', e.target.value)} /></label></div>
          <div className="row">{numeric('protein', t('macro.protein'), a.protein)}{numeric('carbs', t('macro.carbs'), a.carbs)}{numeric('fat', t('macro.fat'), a.fat)}</div>
        </>}
        {numeric('calories', t('proposal.calories'), a.calories)}
      </fieldset>
      {status === 'review' && !valid && <p role="alert">{t('proposal.invalid')}</p>}
      {(status === 'error' || status === 'conflict') && <p role="alert">{t(`proposal.${status}`)}</p>}
      {['saved','cancelled','saving'].includes(status) && <p role="status">{t(`proposal.${status}`)}</p>}
      {status === 'review' && <div className="row"><button className="btn" onClick={() => setStatus('cancelled')}>{t('proposal.cancel')}</button><button className="btn btn-accent" disabled={!valid} onClick={() => void save()}>{t('proposal.confirm')}</button></div>}
      {status === 'error' && <button className="btn btn-block" onClick={() => void save()}>{t('common.retry')}</button>}
    </section>
  )
}
