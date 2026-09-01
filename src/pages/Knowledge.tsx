import { useState } from 'react'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { postJson } from '../lib/api'

interface Tidied {
  relevant: boolean
  title: string
  content: string
  tags: string
}

export default function Knowledge() {
  const { knowledgeItems, addKnowledge, deleteKnowledge } = useStore()
  const { t, lang } = useT()

  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<Tidied | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function tidy() {
    const t0 = text.trim()
    if (!t0 || loading) return
    setLoading(true)
    setError(null)
    setDraft(null)
    try {
      const res = await postJson<Tidied>('/api/knowledge', { text: t0, lang })
      if (!res.relevant) {
        setError(t('knowledge.notRelevant'))
      } else {
        setDraft(res)
      }
    } catch (e) {
      setError(t('knowledge.failed', { msg: e instanceof Error ? e.message : '' }))
    } finally {
      setLoading(false)
    }
  }

  function confirmSave() {
    if (!draft) return
    addKnowledge({ title: draft.title, content: draft.content, tags: draft.tags })
    setDraft(null)
    setText('')
    setError(null)
  }

  return (
    <div className="page">
      <p className="eyebrow" style={{ marginBottom: 20 }}>{t('knowledge.title')}</p>

      {/* 录入 */}
      <div className="card">
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: '0 0 14px' }}>{t('knowledge.tip')}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('knowledge.inputPh')}
          rows={3}
          style={{ width: '100%', resize: 'none', padding: '12px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)', fontSize: 15, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit' }}
        />
        <p className="muted" style={{ fontSize: 12, margin: '8px 2px 0' }}>{t('knowledge.voiceHint')}</p>
        {!draft && (
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={tidy} disabled={loading || !text.trim()}>
            {loading ? t('knowledge.tidying') : t('knowledge.tidy')}
          </button>
        )}
        {error && <p style={{ color: 'var(--protein)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>}

        {/* AI 整理后的预览，确认再存 */}
        {draft && (
          <div style={{ marginTop: 14, background: 'var(--surface-2)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{draft.title}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)' }}>{draft.content}</div>
            {draft.tags && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>#{draft.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean).join('  #')}</div>}
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn" style={{ padding: 12 }} onClick={() => setDraft(null)}>{t('knowledge.discard')}</button>
              <button className="btn btn-accent" style={{ padding: 12 }} onClick={confirmSave}>{t('knowledge.confirm')}</button>
            </div>
          </div>
        )}
      </div>

      {/* 已存知识 */}
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
            <button className="btn-ghost" aria-label="delete" style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }} onClick={() => deleteKnowledge(k.id)}>×</button>
          </div>
        ))
      )}
    </div>
  )
}
