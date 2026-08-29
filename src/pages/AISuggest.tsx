import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { sumMacros, todayStr } from '../lib/nutrition'
import { postJson } from '../lib/api'
import { useT } from '../lib/i18n'

type Mode = 'library' | 'general'

export default function AISuggest() {
  const { meals, profile, savedItems } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, lang } = useT()
  const today = todayStr()
  const didAuto = useRef(false)

  const todayMeals = useMemo(() => meals.filter((m) => m.date === today), [meals, today])
  const totals = useMemo(() => sumMacros(todayMeals), [todayMeals])

  const rem = {
    calories: Math.max(0, Math.round(profile.targetCalories - totals.calories)),
    protein: Math.max(0, Math.round(profile.targetProtein - totals.protein)),
    carbs: Math.max(0, Math.round(profile.targetCarbs - totals.carbs)),
    fat: Math.max(0, Math.round(profile.targetFat - totals.fat)),
  }
  const remItems = [
    { l: t('today.kcal'), v: rem.calories, u: '' },
    { l: t('macro.protein'), v: rem.protein, u: 'g' },
    { l: t('macro.carbs'), v: rem.carbs, u: 'g' },
    { l: t('macro.fat'), v: rem.fat, u: 'g' },
  ]

  const [mode, setMode] = useState<Mode | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 从主页「AI 生成今日饮食」进入时，自动生成（从常用库）
  useEffect(() => {
    if (didAuto.current) return
    didAuto.current = true
    const auto = (location.state as { auto?: Mode } | null)?.auto
    if (auto) run(auto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function run(m: Mode) {
    setMode(m)
    setLoading(true)
    setText(null)
    try {
      const res = await postJson<{ text: string }>('/api/suggest', {
        targets: {
          protein: profile.targetProtein,
          carbs: profile.targetCarbs,
          fat: profile.targetFat,
          calories: profile.targetCalories,
        },
        consumed: totals,
        meals: todayMeals.map((x) => ({ name: x.name, type: x.type })),
        hour: new Date().getHours(),
        mode: m,
        lang,
        savedItems:
          m === 'library'
            ? savedItems.map((s) => ({
                kind: s.kind,
                name: s.name,
                unit: s.unit,
                baseAmount: s.baseAmount,
                protein: s.protein,
                carbs: s.carbs,
                fat: s.fat,
                calories: s.calories,
              }))
            : undefined,
      })
      setText(res.text || t('ai.noSuggestion'))
    } catch (e) {
      setText(t('ai.failed', { msg: e instanceof Error ? e.message : t('ai.retryMsg') }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <button
        className="btn-ghost"
        onClick={() => navigate('/')}
        style={{ padding: 0, marginBottom: 18, fontSize: 14, color: 'var(--text-dim)' }}
      >
        {t('common.backToday')}
      </button>

      {/* 还剩额度 */}
      <div className="card">
        <p className="card-label">{t('ai.remaining')}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {remItems.map((it) => (
            <div key={it.l} style={{ textAlign: 'center' }}>
              <div className="stat-lg num" style={{ fontSize: 24 }}>
                {it.v}
                {it.u}
              </div>
              <div className="muted" style={{ fontSize: 11, letterSpacing: '0.06em', marginTop: 6 }}>
                {it.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 两种方式 */}
      <div className="row">
        <button
          className="btn"
          onClick={() => run('library')}
          disabled={loading}
          style={{
            flexDirection: 'column',
            gap: 4,
            padding: '20px 8px',
            color: mode === 'library' ? 'var(--accent)' : undefined,
            borderColor: mode === 'library' ? 'var(--accent)' : undefined,
          }}
        >
          <span style={{ fontWeight: 600 }}>{t('ai.fromLibrary')}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{t('ai.fromLibrarySub')}</span>
        </button>
        <button
          className="btn"
          onClick={() => run('general')}
          disabled={loading}
          style={{
            flexDirection: 'column',
            gap: 4,
            padding: '20px 8px',
            color: mode === 'general' ? 'var(--accent)' : undefined,
            borderColor: mode === 'general' ? 'var(--accent)' : undefined,
          }}
        >
          <span style={{ fontWeight: 600 }}>{t('ai.general')}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{t('ai.generalSub')}</span>
        </button>
      </div>

      {/* 结果 */}
      {(loading || text) && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="card-label">{mode === 'library' ? t('ai.headerLibrary') : t('ai.headerGeneral')}</p>
          {loading ? (
            <div className="empty">{t('ai.thinking')}</div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-dim)' }}>
              {text}
            </div>
          )}
          {!loading && text && mode && (
            <button className="btn btn-block" style={{ marginTop: 16 }} onClick={() => run(mode)}>
              {t('ai.regenerate')}
            </button>
          )}
        </div>
      )}

      {!mode && (
        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 10 }}>
          {t('ai.pickHint')}
        </p>
      )}
    </div>
  )
}
