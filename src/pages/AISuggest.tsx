import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { sumMacros, todayStr } from '../lib/nutrition'
import { postJson } from '../lib/api'

type Mode = 'library' | 'general'

export default function AISuggest() {
  const { meals, profile, savedItems } = useStore()
  const navigate = useNavigate()
  const today = todayStr()

  const todayMeals = useMemo(() => meals.filter((m) => m.date === today), [meals, today])
  const totals = useMemo(() => sumMacros(todayMeals), [todayMeals])

  const rem = {
    calories: Math.max(0, Math.round(profile.targetCalories - totals.calories)),
    protein: Math.max(0, Math.round(profile.targetProtein - totals.protein)),
    carbs: Math.max(0, Math.round(profile.targetCarbs - totals.carbs)),
    fat: Math.max(0, Math.round(profile.targetFat - totals.fat)),
  }
  const remItems = [
    { l: '热量', v: rem.calories, u: '' },
    { l: '蛋白', v: rem.protein, u: 'g' },
    { l: '碳水', v: rem.carbs, u: 'g' },
    { l: '脂肪', v: rem.fat, u: 'g' },
  ]

  const [mode, setMode] = useState<Mode | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      setText(res.text || '暂时没有建议。')
    } catch (e) {
      setText('生成失败：' + (e instanceof Error ? e.message : '请稍后再试'))
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
        ‹ 今日
      </button>

      {/* 还剩额度 */}
      <div className="card">
        <p className="card-label">还剩额度</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {remItems.map((it) => (
            <div key={it.l} style={{ textAlign: 'center' }}>
              <div className="stat-lg num" style={{ fontSize: 24 }}>
                {it.v}
                {it.u}
              </div>
              <div
                className="muted"
                style={{ fontSize: 11, letterSpacing: '0.1em', marginTop: 6, textTransform: 'uppercase' }}
              >
                {it.l}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 两种方式 */}
      <div className="row">
        <button
          className={'btn' + (mode === 'library' ? ' btn-accent' : '')}
          onClick={() => run('library')}
          disabled={loading}
          style={{ flexDirection: 'column', gap: 4, padding: '20px 8px' }}
        >
          <span style={{ fontWeight: 600 }}>从我的常用</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>食物 / 套餐里挑</span>
        </button>
        <button
          className={'btn' + (mode === 'general' ? ' btn-accent' : '')}
          onClick={() => run('general')}
          disabled={loading}
          style={{ flexDirection: 'column', gap: 4, padding: '20px 8px' }}
        >
          <span style={{ fontWeight: 600 }}>通用建议</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>不限于常用</span>
        </button>
      </div>

      {/* 结果 */}
      {(loading || text) && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="card-label">{mode === 'library' ? '从你的常用推荐' : '通用建议'}</p>
          {loading ? (
            <div className="empty">思考中…</div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-dim)' }}>
              {text}
            </div>
          )}
          {!loading && text && mode && (
            <button className="btn btn-block" style={{ marginTop: 16 }} onClick={() => run(mode)}>
              重新生成
            </button>
          )}
        </div>
      )}

      {!mode && (
        <p className="muted" style={{ textAlign: 'center', fontSize: 13, marginTop: 10 }}>
          选一种方式，AI 会结合你今天已吃的来建议
        </p>
      )}
    </div>
  )
}
