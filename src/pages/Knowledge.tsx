import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { postJson } from '../lib/api'
import { RecordConflict } from '../lib/recordMutations'

interface Tidied {
  relevant: boolean
  title: string
  content: string
  tags: string
}

export default function Knowledge() {
  const { knowledgeItems, addKnowledge, updateKnowledge, deleteKnowledge } = useStore()
  const { t, lang } = useT()
  const navigate = useNavigate()

  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<(Tidied & { id: string; replacing: boolean }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [conflict, setConflict] = useState(false)
  const working = useRef(false)
  const zh = lang === 'zh'

  async function tidy() {
    const t0 = text.trim()
    if (!t0 || working.current || attempted) return
    working.current = true
    setLoading(true)
    setError(null)
    setDraft(null)
    try {
      const res = await postJson<Tidied>('/api/knowledge', { text: t0, lang })
      if (!res.relevant) {
        setError(t('knowledge.notRelevant'))
      } else {
        const existing = knowledgeItems.find(item => item.title === res.title)
        setDraft({ ...res, id: existing?.id ?? crypto.randomUUID(), replacing: !!existing })
      }
    } catch (e) {
      setError(t('knowledge.failed', { msg: e instanceof Error ? e.message : '' }))
    } finally {
      setLoading(false)
      working.current = false
    }
  }

  async function confirmSave() {
    if (!draft || working.current || conflict) return
    working.current = true; setSaving(true); setAttempted(true); setError(null)
    try {
      const content = { title: draft.title, content: draft.content, tags: draft.tags }
      if (draft.replacing) await updateKnowledge(draft.id, content)
      else await addKnowledge(content, draft.id)
      setDraft(null); setText(''); setAttempted(false)
    } catch (reason) {
      const collision = reason instanceof RecordConflict
      setConflict(collision)
      setError(collision
        ? (zh ? '已有记录内容不同，请返回查看。' : 'This record has different saved content. Go back and review it.')
        : (zh ? '未能确认保存结果，内容已保留，请重试。' : 'Could not confirm the save. Your draft is kept; please retry.'))
    } finally { working.current = false; setSaving(false) }
  }

  async function remove(id: string) {
    if (working.current || attempted) return
    if (!window.confirm(zh ? '删除这条知识？' : 'Delete this knowledge item?')) return
    working.current = true; setSaving(true); setError(null)
    try { await deleteKnowledge(id) }
    catch { setError(zh ? '未能确认删除结果，请重试。' : 'Could not confirm the deletion. Please retry.') }
    finally { working.current = false; setSaving(false) }
  }

  return (
    <div className="page">
      <button className="btn-ghost" disabled={loading || saving} onClick={() => navigate('/coach')} style={{ padding: 0, marginBottom: 20 }}>{t('common.backCoach')}</button>
      <p className="eyebrow" style={{ marginBottom: 20 }}>{t('knowledge.title')}</p>

      {/* Draft input */}
      <div className="card">
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: '0 0 14px' }}>{t('knowledge.tip')}</p>
        <textarea
          disabled={loading || saving || !!draft}
          maxLength={8000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('knowledge.inputPh')}
          rows={3}
          style={{ width: '100%', resize: 'none', padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)', fontSize: 15, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit' }}
        />
        <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>{t('knowledge.voiceHint')}</p>
        {!draft && (
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={tidy} disabled={loading || saving || !text.trim()}>
            {loading ? t('knowledge.tidying') : t('knowledge.tidy')}
          </button>
        )}
        {error && <p role="alert" style={{ color: 'var(--protein)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>}

        {/* Preview before confirmation */}
        {draft && (
          <div style={{ marginTop: 14, background: 'var(--surface-2)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{draft.title}</div>
            {draft.replacing && <p>{zh ? '确认后将替换已有的同名知识。' : 'Confirming will replace the existing item with this title.'}</p>}
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)' }}>{draft.content}</div>
            {draft.tags && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>#{draft.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean).join('  #')}</div>}
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn" disabled={saving || attempted} style={{ padding: 12 }} onClick={() => { setDraft(null); setError(null) }}>{t('knowledge.discard')}</button>
              <button className="btn btn-accent" disabled={saving || conflict} style={{ padding: 12 }} onClick={confirmSave}>{saving ? (zh ? '保存中…' : 'Saving…') : attempted ? t('common.retry') : t('knowledge.confirm')}</button>
            </div>
          </div>
        )}
      </div>

      {/* Saved knowledge */}
      <p className="card-label" style={{ margin: '26px 4px 10px' }}>{t('knowledge.myKnowledge')}</p>
      {knowledgeItems.length === 0 ? (
        <div className="card"><div className="empty">{t('knowledge.empty')}</div></div>
      ) : (
        knowledgeItems.map((k) => (
          <div key={k.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{k.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)' }}>{k.content}</div>
              {k.tags && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>#{k.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean).join('  #')}</div>}
            </div>
            <button className="btn-ghost" disabled={loading || saving || attempted} aria-label={zh ? `删除 ${k.title}` : `Delete ${k.title}`} style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }} onClick={() => remove(k.id)}>×</button>
          </div>
        ))
      )}
    </div>
  )
}
