import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { estimateCalories, round1, scale, todayStr } from '../lib/nutrition'
import { postJson } from '../lib/api'
import { fileToResizedBase64 } from '../lib/image'
import { useT } from '../lib/i18n'
import { MEAL_TYPES, type MealType, type SavedItem, type SavedKind } from '../types'

// 拍照识别返回的单项
type RecogItem = {
  name: string
  amount: number
  unit: string
  protein: number
  carbs: number
  fat: number
  calories: number
}

function guessMealType(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

// 单位存储用规范值，显示按语言本地化
const UNITS = ['g', '份', 'ml', '个', '勺']

export default function LogMeal() {
  const { addMeal, meals, deleteMeal, savedItems, addSavedItem, deleteSavedItem } = useStore()
  const navigate = useNavigate()
  const { t, lang } = useT()
  const today = todayStr()

  const [type, setType] = useState<MealType>(guessMealType())
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('g')
  const [amount, setAmount] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [calories, setCalories] = useState('')

  const base = useRef<{ amount: number; p: number; c: number; f: number; cal: number } | null>(null)

  const [pickTab, setPickTab] = useState<SavedKind>('food')
  const [manageMode, setManageMode] = useState(false)
  const [saveToLib, setSaveToLib] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [recogItems, setRecogItems] = useState<RecogItem[]>([])
  const [recogError, setRecogError] = useState<string | null>(null)

  const [looking, setLooking] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)

  const autoCal = estimateCalories(+protein || 0, +carbs || 0, +fat || 0)

  const picks = useMemo(() => savedItems.filter((s) => s.kind === pickTab), [savedItems, pickTab])

  const todayMeals = useMemo(
    () => meals.filter((m) => m.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [meals, today],
  )
  const savedMealNames = useMemo(
    () => new Set(savedItems.filter((s) => s.kind === 'meal').map((s) => s.name)),
    [savedItems],
  )

  // 单位本地化显示（存储值保持规范）
  const unitLabel = (u: string): string => {
    if (u === '份') return t('unit.serving')
    if (u === '个') return t('unit.piece')
    if (u === '勺') return t('unit.spoon')
    return u // g / ml 通用
  }

  function fillForm(v: RecogItem) {
    setName(v.name)
    setUnit(v.unit)
    setAmount(String(v.amount))
    setProtein(String(v.protein))
    setCarbs(String(v.carbs))
    setFat(String(v.fat))
    setCalories(String(v.calories))
    base.current = { amount: v.amount, p: v.protein, c: v.carbs, f: v.fat, cal: v.calories }
  }

  function fillFrom(item: SavedItem) {
    fillForm({
      name: item.name,
      unit: item.unit,
      amount: item.baseAmount,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      calories: item.calories,
    })
  }

  function changeAmount(val: string) {
    setAmount(val)
    const a = parseFloat(val)
    const b = base.current
    if (b && a > 0) {
      setProtein(String(round1(scale(b.p, a, b.amount))))
      setCarbs(String(round1(scale(b.c, a, b.amount))))
      setFat(String(round1(scale(b.f, a, b.amount))))
      setCalories(String(Math.round(scale(b.cal, a, b.amount))))
    }
  }

  function editMacro(setter: (v: string) => void, val: string) {
    base.current = null
    setter(val)
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setRecognizing(true)
    setRecogError(null)
    setRecogItems([])
    try {
      const { data, mediaType } = await fileToResizedBase64(file)
      const { items } = await postJson<{ items: RecogItem[] }>('/api/recognize', { image: data, mediaType, lang })
      if (!items.length) setRecogError(t('log.recogEmpty'))
      else {
        setRecogItems(items)
        fillForm(items[0])
      }
    } catch (err) {
      setRecogError(err instanceof Error ? err.message : t('log.recogEmpty'))
    } finally {
      setRecognizing(false)
    }
  }

  // 手动输入食物名 → 查营养库自动填营养值（保留用户输入的名字）
  async function lookupName() {
    const q = name.trim()
    if (!q) return
    setLooking(true)
    setLookupMsg(null)
    try {
      type Match = { matched: boolean; unit: string; baseAmount: number; protein: number; carbs: number; fat: number; calories: number }
      const { match } = await postJson<{ match: Match | null }>('/api/lookup', { name: q })
      if (match && match.matched) {
        setUnit(match.unit)
        setAmount(String(match.baseAmount))
        setProtein(String(match.protein))
        setCarbs(String(match.carbs))
        setFat(String(match.fat))
        setCalories(String(match.calories))
        base.current = { amount: match.baseAmount, p: match.protein, c: match.carbs, f: match.fat, cal: match.calories }
        setLookupMsg(t('log.lookupHit'))
      } else {
        setLookupMsg(t('log.lookupMiss'))
      }
    } catch {
      setLookupMsg(t('log.lookupMiss'))
    } finally {
      setLooking(false)
    }
  }

  function handleSave() {
    if (!name.trim()) return
    const p = +protein || 0
    const c = +carbs || 0
    const f = +fat || 0
    const cal = +calories || autoCal
    const amt = +amount || undefined
    addMeal({ date: todayStr(), type, name: name.trim(), amount: amt, unit, protein: p, carbs: c, fat: f, calories: cal })
    if (saveToLib) {
      addSavedItem({ kind: pickTab, name: name.trim(), unit, baseAmount: amt ?? 1, protein: p, carbs: c, fat: f, calories: cal })
    }
    navigate('/')
  }

  const quickAmounts = base.current
    ? [0.5, 1, 1.5, 2].map((k) => round1(base.current!.amount * k))
    : []

  return (
    <div className="page">
      {/* 拍照识别 */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
      <button
        className="card"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', textAlign: 'left' }}
        onClick={() => fileRef.current?.click()}
        disabled={recognizing}
      >
        <span style={{ fontSize: 24 }}>◐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{recognizing ? t('log.recognizing') : t('log.photoTitle')}</div>
          <div className="muted" style={{ fontSize: 12 }}>{recognizing ? t('log.analyzing') : t('log.photoSub')}</div>
        </div>
        <span className="dim">›</span>
      </button>

      {/* 识别结果 */}
      {(recogItems.length > 0 || recogError) && (
        <div className="card">
          <p className="card-label">{t('log.recogResult')}</p>
          {recogError ? (
            <div className="empty">{recogError}</div>
          ) : (
            <>
              {recogItems.map((it, i) => (
                <div key={i} className="list-row" style={{ padding: '12px 0' }}>
                  <button onClick={() => fillForm(it)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                      <span className="muted" style={{ fontWeight: 400 }}> · {it.amount}{unitLabel(it.unit)}</span>
                    </div>
                    <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {it.calories} {t('today.kcal')} · {t('macro.protein')} {it.protein} {t('macro.carbs')} {it.carbs} {t('macro.fat')} {it.fat}
                    </div>
                  </button>
                  <span className="dim" style={{ fontSize: 20 }}>＋</span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('log.recogHint')}</p>
            </>
          )}
        </div>
      )}

      {/* 常用快捷选择 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={'chip' + (pickTab === 'food' ? ' active' : '')} onClick={() => setPickTab('food')}>
              {t('log.freqFoods')}
            </button>
            <button className={'chip' + (pickTab === 'meal' ? ' active' : '')} onClick={() => setPickTab('meal')}>
              {t('log.myMeals')}
            </button>
          </div>
          {picks.length > 0 && (
            <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setManageMode((v) => !v)}>
              {manageMode ? t('common.done') : t('common.manage')}
            </button>
          )}
        </div>

        {picks.length === 0 ? (
          <div className="empty">
            {pickTab === 'food' ? t('log.noFreqFood') : t('log.noFreqMeal')}
            <br />
            {t('log.saveHint')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {picks.map((item) => (
              <div key={item.id} className="list-row" style={{ padding: '14px 0' }}>
                <button onClick={() => !manageMode && fillFrom(item)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                    <span className="muted" style={{ fontWeight: 400 }}> · {item.baseAmount}{unitLabel(item.unit)}</span>
                  </div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {item.calories} {t('today.kcal')} · {t('macro.protein')} {item.protein} {t('macro.carbs')} {item.carbs} {t('macro.fat')} {item.fat}
                    {item.note ? ` · ${item.note}` : ''}
                  </div>
                </button>
                {manageMode ? (
                  <button className="btn-ghost" style={{ color: 'var(--protein)', fontSize: 20, padding: 6 }} onClick={() => deleteSavedItem(item.id)} aria-label={t('common.done')}>
                    −
                  </button>
                ) : (
                  <span className="dim" style={{ fontSize: 20 }}>＋</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 餐次 */}
      <div className="card">
        <p className="card-label">{t('log.mealType')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {MEAL_TYPES.map((mt) => (
            <button
              key={mt}
              onClick={() => setType(mt)}
              className="chip"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: type === mt ? 'var(--surface-2)' : 'var(--surface)',
                color: type === mt ? 'var(--accent)' : 'var(--text)',
                borderColor: type === mt ? 'var(--accent)' : 'var(--line)',
                fontWeight: type === mt ? 600 : 400,
              }}
            >
              {t('meal.' + mt)}
            </button>
          ))}
        </div>
      </div>

      {/* 手动填写 */}
      <div className="card">
        <div className="field" style={{ marginBottom: 10 }}>
          <label>{t('log.foodName')}</label>
          <input placeholder={t('log.foodNamePh')} value={name} onChange={(e) => { setName(e.target.value); setLookupMsg(null) }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button
            className="chip"
            onClick={lookupName}
            disabled={looking || !name.trim()}
            style={{ padding: '7px 14px', fontSize: 13, opacity: !name.trim() ? 0.5 : 1 }}
          >
            ⌕ {looking ? t('log.looking') : t('log.lookup')}
          </button>
          {lookupMsg && <span className="muted" style={{ fontSize: 12, color: 'var(--accent)' }}>{lookupMsg}</span>}
        </div>

        <div className="field">
          <label>{t('log.amount')}</label>
          <input type="number" inputMode="decimal" placeholder="100" value={amount} onChange={(e) => changeAmount(e.target.value)} />
        </div>

        <div className="field">
          <label>{t('log.unit')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {UNITS.map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className="chip"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  padding: '10px 4px',
                  background: unit === u ? 'var(--surface-2)' : 'var(--surface)',
                  color: unit === u ? 'var(--accent)' : 'var(--text)',
                  borderColor: unit === u ? 'var(--accent)' : 'var(--line)',
                  fontWeight: unit === u ? 600 : 400,
                }}
              >
                {unitLabel(u)}
              </button>
            ))}
          </div>
        </div>

        {quickAmounts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, margin: '4px 0 20px', flexWrap: 'wrap' }}>
            {quickAmounts.map((a) => (
              <button key={a} className={'chip' + (+amount === a ? ' active' : '')} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => changeAmount(String(a))}>
                {a}{unitLabel(unit)}
              </button>
            ))}
          </div>
        )}

        {base.current && (
          <p className="muted" style={{ fontSize: 12, margin: '-6px 0 16px', color: 'var(--accent)' }}>
            {t('log.scaleHint')}
          </p>
        )}

        <div className="row">
          <div className="field">
            <label>{t('log.proteinG')}</label>
            <input type="number" inputMode="decimal" placeholder="0" value={protein} onChange={(e) => editMacro(setProtein, e.target.value)} />
          </div>
          <div className="field">
            <label>{t('log.carbsG')}</label>
            <input type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={(e) => editMacro(setCarbs, e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>{t('log.fatG')}</label>
            <input type="number" inputMode="decimal" placeholder="0" value={fat} onChange={(e) => editMacro(setFat, e.target.value)} />
          </div>
          <div className="field">
            <label>{t('log.kcalField')}</label>
            <input type="number" inputMode="decimal" placeholder={autoCal ? t('log.autoCal', { n: autoCal }) : '0'} value={calories} onChange={(e) => editMacro(setCalories, e.target.value)} />
          </div>
        </div>

        <button
          onClick={() => setSaveToLib((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '4px 0', color: saveToLib ? 'var(--accent)' : 'var(--text-dim)' }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              border: '1px solid ' + (saveToLib ? 'var(--accent)' : 'var(--line-strong)'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              background: saveToLib ? 'var(--accent)' : 'transparent',
              color: '#1a1206',
            }}
          >
            {saveToLib ? '✓' : ''}
          </span>
          <span style={{ fontSize: 14 }}>
            {pickTab === 'food' ? t('log.saveToFreqFood') : t('log.saveToFreqMeal')}
            <span className="muted" style={{ fontSize: 12 }}>{t('log.saveBasis')}</span>
          </span>
        </button>
      </div>

      <div className="row">
        <button className="btn" onClick={() => navigate(-1)}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
          {t('log.saveRecord')}
        </button>
      </div>

      {/* 今日已记录 */}
      {todayMeals.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="card-label">{t('log.loggedToday')}</p>
          {todayMeals.map((m) => {
            const saved = savedMealNames.has(m.name)
            return (
              <div key={m.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                    {m.amount ? <span className="muted" style={{ fontWeight: 400 }}> · {m.amount}{unitLabel(m.unit ?? '')}</span> : null}
                  </div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {t('meal.' + m.type)} · {m.calories} {t('today.kcal')} · {t('macro.protein')} {m.protein} {t('macro.carbs')} {m.carbs} {t('macro.fat')} {m.fat}
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 18, padding: 6, color: saved ? 'var(--accent)' : 'var(--text-muted)' }}
                  onClick={() =>
                    addSavedItem({ kind: 'meal', name: m.name, unit: m.unit ?? '份', baseAmount: m.amount ?? 1, protein: m.protein, carbs: m.carbs, fat: m.fat, calories: m.calories })
                  }
                >
                  {saved ? '★' : '☆'}
                </button>
                <button className="btn-ghost" aria-label={t('common.cancel')} style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }} onClick={() => deleteMeal(m.id)}>
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
