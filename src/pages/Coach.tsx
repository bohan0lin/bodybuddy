import { useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { dateOffset, macrosByDate, sumMacros, todayStr } from '../lib/nutrition'
import { postJson } from '../lib/api'
import { fileToResizedBase64 } from '../lib/image'
import { useT } from '../lib/i18n'
import type { MealType } from '../types'

interface Action {
  type: 'log' | 'save' | 'workout'
  mealType?: MealType
  kind?: 'food' | 'meal'
  name?: string
  brand?: string
  amount?: number
  unit?: string
  baseAmount?: number
  protein?: number
  carbs?: number
  fat?: number
  calories?: number
  workoutType?: string
  note?: string
  durationMin?: number
}

interface Msg {
  role: 'user' | 'assistant'
  text: string
  image?: string
  actions?: Action[]
  done?: Record<number, boolean>
}

// AI 教练：整屏对话页（原悬浮助手改造而来）
export default function Coach() {
  const { profile, meals, savedItems, latestWeight, workouts, addMeal, addSavedItem, addWorkout } = useStore()
  const { t, lang } = useT()
  const kcalLabel = t('today.kcal')

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const context = useMemo(() => {
    const today = todayStr()
    const todayMeals = meals.filter((m) => m.date === today)
    const byDate = macrosByDate(meals)
    const recentDays = Array.from({ length: 7 }, (_, i) => {
      const d = dateOffset(i - 6)
      const mm = byDate.get(d) ?? { protein: 0, carbs: 0, fat: 0, calories: 0 }
      return { date: d, calories: Math.round(mm.calories), protein: Math.round(mm.protein), carbs: Math.round(mm.carbs), fat: Math.round(mm.fat) }
    })
    const wkLabel = (k: string) => t(('workout.type.' + k) as 'workout.type.strength')
    const since = dateOffset(-6)
    const todayWorkouts = workouts.filter((w) => w.date === today).map((w) => ({ type: wkLabel(w.type), note: w.note, durationMin: w.durationMin, calories: w.calories }))
    const recentWorkouts = workouts
      .filter((w) => w.date >= since)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((w) => ({ date: w.date, type: wkLabel(w.type), durationMin: w.durationMin, calories: w.calories }))
    return {
      targets: { protein: profile.targetProtein, carbs: profile.targetCarbs, fat: profile.targetFat, calories: profile.targetCalories },
      consumed: sumMacros(todayMeals),
      todayMeals: todayMeals.map((m) => ({ name: m.name, type: m.type })),
      todayWorkouts,
      recentDays,
      recentWorkouts,
      savedItems: savedItems.map((s) => ({ kind: s.kind, name: s.name, brand: s.brand, unit: s.unit, baseAmount: s.baseAmount, protein: s.protein, carbs: s.carbs, fat: s.fat, calories: s.calories })),
      latestWeight: latestWeight ? { weight: latestWeight.weight, bodyFat: latestWeight.bodyFat } : undefined,
      hour: new Date().getHours(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, meals, savedItems, latestWeight, workouts, lang])

  function scrollDown() {
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const { data, mediaType } = await fileToResizedBase64(file)
    setImage(`data:${mediaType};base64,${data}`)
  }

  async function send() {
    const text = input.trim()
    if ((!text && !image) || loading) return
    const userMsg: Msg = { role: 'user', text: text || (lang === 'zh' ? '这张图' : 'this photo'), image: image ?? undefined }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setImage(null)
    setLoading(true)
    scrollDown()
    try {
      const payloadMsgs = history.map((m, i) => ({ role: m.role, text: m.text, image: i === history.length - 1 ? m.image : undefined }))
      const res = await postJson<{ reply: string; actions: Action[] }>('/api/assistant', { messages: payloadMsgs, context, lang })
      setMessages((ms) => [...ms, { role: 'assistant', text: res.reply, actions: res.actions ?? [], done: {} }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      const busy = /503|overload|unavailable|429|rate limit/i.test(msg)
      setMessages((ms) => [...ms, { role: 'assistant', text: busy ? t('assistant.busy') : t('assistant.failed') + (msg ? '\n\n[' + msg + ']' : '') }])
    } finally {
      setLoading(false)
      scrollDown()
    }
  }

  function confirmAction(mi: number, ai: number) {
    const a = messages[mi].actions?.[ai]
    if (!a) return
    if (a.type === 'log') {
      addMeal({ date: todayStr(), type: (a.mealType ?? 'snack') as MealType, name: a.name ?? '', brand: a.brand || undefined, amount: a.amount, unit: a.unit ?? 'g', protein: a.protein ?? 0, carbs: a.carbs ?? 0, fat: a.fat ?? 0, calories: a.calories ?? 0 })
    } else if (a.type === 'workout') {
      addWorkout({ date: todayStr(), type: a.workoutType ?? 'other', note: a.note || undefined, durationMin: a.durationMin ?? 0, calories: a.calories ?? 0 })
    } else {
      addSavedItem({ kind: a.kind ?? 'food', name: a.name ?? '', brand: a.brand || undefined, unit: a.unit ?? 'g', baseAmount: a.baseAmount ?? 1, protein: a.protein ?? 0, carbs: a.carbs ?? 0, fat: a.fat ?? 0, calories: a.calories ?? 0 })
    }
    setMessages((ms) => ms.map((m, i) => (i === mi ? { ...m, done: { ...(m.done ?? {}), [ai]: true } } : m)))
  }

  function dismissAction(mi: number, ai: number) {
    setMessages((ms) => ms.map((m, i) => (i === mi ? { ...m, done: { ...(m.done ?? {}), [ai]: true } } : m)))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'calc(env(safe-area-inset-top) + 20px) 20px 12px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.02em' }}>✦ {t('assistant.title')}</span>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 16px' }}>
        {messages.length === 0 && (
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, textAlign: 'center', padding: '20px 10px' }}>{t('assistant.greeting')}</p>
        )}
        {messages.map((m, mi) => (
          <div key={mi} style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.image && <img src={m.image} alt="" style={{ maxWidth: 160, borderRadius: 12, marginBottom: 6 }} />}
            {m.text && (
              <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: m.role === 'user' ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid var(--line)', color: m.role === 'user' ? 'var(--text)' : 'var(--text-dim)' }}>
                {m.text}
              </div>
            )}
            {m.actions?.map((a, ai) => (
              <div key={ai} className="card" style={{ marginTop: 8, marginBottom: 0, width: '85%', padding: 16 }}>
                <p className="card-label" style={{ marginBottom: 10 }}>{a.type === 'log' ? t('assistant.logAction') : a.type === 'workout' ? t('workout.title') : t('assistant.saveAction')}</p>
                {a.type === 'workout' ? (
                  <>
                    <div style={{ fontWeight: 500 }}>
                      {t(('workout.type.' + a.workoutType) as 'workout.type.strength')}
                      {a.note ? <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {a.note}</span> : null}
                    </div>
                    <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {a.durationMin} {t('workout.min')} · {Math.round(a.calories ?? 0)} {kcalLabel}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 500 }}>
                      {a.name}
                      {a.brand ? <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {a.brand}</span> : null}
                      {a.amount ? <span className="muted" style={{ fontWeight: 400 }}> · {a.amount}{a.unit ?? ''}</span> : a.baseAmount ? <span className="muted" style={{ fontWeight: 400 }}> · {a.baseAmount}{a.unit ?? ''}</span> : null}
                    </div>
                    <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {Math.round(a.calories ?? 0)} {kcalLabel} · {t('macro.protein')} {a.protein} {t('macro.carbs')} {a.carbs} {t('macro.fat')} {a.fat}
                    </div>
                  </>
                )}
                {m.done?.[ai] ? (
                  <p style={{ color: 'var(--accent)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>{t('assistant.done')}</p>
                ) : (
                  <div className="row" style={{ marginTop: 14 }}>
                    <button className="btn" style={{ padding: '10px' }} onClick={() => dismissAction(mi, ai)}>{t('assistant.dismiss')}</button>
                    <button className="btn btn-accent" style={{ padding: '10px' }} onClick={() => confirmAction(mi, ai)}>{t('assistant.confirm')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {loading && <p className="muted" style={{ fontSize: 13 }}>{t('assistant.thinking')}</p>}
      </div>

      {/* input */}
      <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
        {image && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <img src={image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
            <span className="muted" style={{ fontSize: 12 }}>{t('assistant.photoReady')}</span>
            <button className="btn-ghost" style={{ fontSize: 16 }} onClick={() => setImage(null)}>×</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: 'none' }} />
          <button className="btn-ghost" style={{ padding: 6, color: 'var(--text-dim)', display: 'flex' }} onClick={() => fileRef.current?.click()} aria-label="photo">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l1.4-2h7.2L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={t('assistant.placeholder')}
            style={{ flex: 1, padding: '11px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 999, color: 'var(--text)', outline: 'none' }}
          />
          <button className="btn btn-accent" style={{ padding: '11px 16px' }} onClick={send} disabled={loading || (!input.trim() && !image)}>↑</button>
        </div>
      </div>
    </div>
  )
}
