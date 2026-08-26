import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { estimateCalories, round1, scale, todayStr } from '../lib/nutrition'
import { postJson } from '../lib/api'
import { fileToResizedBase64 } from '../lib/image'
import { useT } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'
import EnergyToggle from '../components/EnergyToggle'
import { MEAL_TYPES, type Meal, type MealType, type SavedItem, type SavedKind } from '../types'

type RecogItem = { name: string; amount: number; unit: string; protein: number; carbs: number; fat: number; calories: number }
type EditState = { kind: 'saved' | 'meal'; id: string } | null

function guessMealType(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

const UNITS = ['g', '份', 'ml', '个', '勺']

export default function LogMeal() {
  const { addMeal, updateMeal, meals, deleteMeal, savedItems, addSavedItem, updateSavedItem, deleteSavedItem } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = useRef<string | null>(null)
  const didInit = useRef(false)
  const { t, lang } = useT()
  const { energyUnit, toEnergy, fromEnergy } = usePrefs()
  const energyLabel = t(energyUnit === 'kJ' ? 'energy.kJ' : 'energy.kcal')
  const today = todayStr()

  const [type, setType] = useState<MealType>(guessMealType())
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [unit, setUnit] = useState('g')
  const [amount, setAmount] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [calories, setCalories] = useState('') // 内部存千卡

  const base = useRef<{ amount: number; p: number; c: number; f: number; cal: number } | null>(null)

  const [pickTab, setPickTab] = useState<SavedKind>('food')
  const [saveToLib, setSaveToLib] = useState(false)
  const [edit, setEdit] = useState<EditState>(null)

  const [libraryOpen, setLibraryOpen] = useState(false)
  const [manageLib, setManageLib] = useState(false)
  const [query, setQuery] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [recogItems, setRecogItems] = useState<RecogItem[]>([])
  const [recogError, setRecogError] = useState<string | null>(null)

  const [looking, setLooking] = useState(false)
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)

  const autoCal = estimateCalories(+protein || 0, +carbs || 0, +fat || 0)

  const tabItems = useMemo(() => savedItems.filter((s) => s.kind === pickTab), [savedItems, pickTab])
  const recent = useMemo(() => tabItems.slice(0, 5), [tabItems])
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tabItems.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.brand ?? '').toLowerCase().includes(q))
  }, [tabItems, query])

  const todayMeals = useMemo(
    () => meals.filter((m) => m.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [meals, today],
  )

  const unitLabel = (u: string): string => {
    if (u === '份') return t('unit.serving')
    if (u === '个') return t('unit.piece')
    if (u === '勺') return t('unit.spoon')
    return u
  }

  function resetForm() {
    setName(''); setBrand(''); setUnit('g'); setAmount(''); setProtein(''); setCarbs(''); setFat(''); setCalories('')
    base.current = null
  }

  function fillForm(v: RecogItem & { brand?: string }) {
    setName(v.name); setBrand(v.brand ?? ''); setUnit(v.unit); setAmount(String(v.amount))
    setProtein(String(v.protein)); setCarbs(String(v.carbs)); setFat(String(v.fat)); setCalories(String(v.calories))
    base.current = { amount: v.amount, p: v.protein, c: v.carbs, f: v.fat, cal: v.calories }
  }
  function fillFrom(item: SavedItem) {
    fillForm({ name: item.name, brand: item.brand, unit: item.unit, amount: item.baseAmount, protein: item.protein, carbs: item.carbs, fat: item.fat, calories: item.calories })
  }

  function startEditSaved(item: SavedItem) {
    setEdit({ kind: 'saved', id: item.id }); fillFrom(item); setSaveToLib(false); setLibraryOpen(false)
  }
  function startEditMeal(m: Meal) {
    setEdit({ kind: 'meal', id: m.id })
    setName(m.name); setBrand(m.brand ?? ''); setUnit(m.unit ?? 'g'); setAmount(m.amount ? String(m.amount) : '')
    setProtein(String(m.protein)); setCarbs(String(m.carbs)); setFat(String(m.fat)); setCalories(String(m.calories))
    setType(m.type)
    base.current = m.amount ? { amount: m.amount, p: m.protein, c: m.carbs, f: m.fat, cal: m.calories } : null
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function cancelEdit() {
    const rt = returnTo.current
    returnTo.current = null
    setEdit(null)
    resetForm()
    if (rt) navigate(rt)
  }

  // 从某天详情进入编辑：读取路由 state（只处理一次）
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    const st = location.state as { editMeal?: Meal; returnTo?: string } | null
    if (st?.editMeal) {
      returnTo.current = st.returnTo ?? null
      startEditMeal(st.editMeal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  function editMacro(setter: (v: string) => void, val: string) { base.current = null; setter(val) }
  function editCalories(shown: string) { base.current = null; setCalories(shown === '' ? '' : String(Math.round(fromEnergy(Number(shown) || 0)))) }

  async function lookupName() {
    const q = name.trim()
    if (!q) return
    setLooking(true); setLookupMsg(null)
    try {
      type Match = { matched: boolean; unit: string; baseAmount: number; protein: number; carbs: number; fat: number; calories: number }
      const { match } = await postJson<{ match: Match | null }>('/api/lookup', { name: q })
      if (match && match.matched) {
        setUnit(match.unit); setAmount(String(match.baseAmount))
        setProtein(String(match.protein)); setCarbs(String(match.carbs)); setFat(String(match.fat)); setCalories(String(match.calories))
        base.current = { amount: match.baseAmount, p: match.protein, c: match.carbs, f: match.fat, cal: match.calories }
        setLookupMsg(t('log.lookupHit'))
      } else setLookupMsg(t('log.lookupMiss'))
    } catch { setLookupMsg(t('log.lookupMiss')) } finally { setLooking(false) }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setRecognizing(true); setRecogError(null); setRecogItems([])
    try {
      const { data, mediaType } = await fileToResizedBase64(file)
      const { items } = await postJson<{ items: RecogItem[] }>('/api/recognize', { image: data, mediaType, lang })
      if (!items.length) setRecogError(t('log.recogEmpty'))
      else { setRecogItems(items); fillForm(items[0]) }
    } catch (err) {
      setRecogError(err instanceof Error ? err.message : t('log.recogEmpty'))
    } finally { setRecognizing(false) }
  }

  function currentFields() {
    return { p: +protein || 0, c: +carbs || 0, f: +fat || 0, cal: +calories || autoCal, amt: +amount || undefined }
  }
  function handleSave() {
    if (!name.trim()) return
    const { p, c, f, cal, amt } = currentFields()
    addMeal({ date: todayStr(), type, name: name.trim(), brand: brand.trim() || undefined, amount: amt, unit, protein: p, carbs: c, fat: f, calories: cal })
    if (saveToLib) addSavedItem({ kind: pickTab, name: name.trim(), brand: brand.trim() || undefined, unit, baseAmount: amt ?? 1, protein: p, carbs: c, fat: f, calories: cal })
    navigate('/')
  }
  function savePrimary() {
    if (!name.trim()) return
    const { p, c, f, cal, amt } = currentFields()
    if (edit?.kind === 'saved') {
      updateSavedItem(edit.id, { name: name.trim(), brand: brand.trim() || undefined, unit, baseAmount: amt ?? 1, protein: p, carbs: c, fat: f, calories: cal })
      cancelEdit()
    } else if (edit?.kind === 'meal') {
      updateMeal(edit.id, { type, name: name.trim(), brand: brand.trim() || undefined, amount: amt, unit, protein: p, carbs: c, fat: f, calories: cal })
      cancelEdit()
    } else handleSave()
  }

  const quickAmounts = base.current ? [0.5, 1, 1.5, 2].map((k) => round1(base.current!.amount * k)) : []

  const macroLine = (cal: number, p: number, c: number, f: number) =>
    `${toEnergy(cal)} ${energyLabel} · ${t('macro.protein')} ${p} ${t('macro.carbs')} ${c} ${t('macro.fat')} ${f}`

  return (
    <div className="page">
      {/* 拍照识别 */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
      <button className="card" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', textAlign: 'left' }} onClick={() => fileRef.current?.click()} disabled={recognizing}>
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
          {recogError ? <div className="empty">{recogError}</div> : (
            <>
              {recogItems.map((it, i) => (
                <div key={i} className="list-row" style={{ padding: '12px 0' }}>
                  <button onClick={() => fillForm(it)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}<span className="muted" style={{ fontWeight: 400 }}> · {it.amount}{unitLabel(it.unit)}</span></div>
                    <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{macroLine(it.calories, it.protein, it.carbs, it.fat)}</div>
                  </button>
                  <span className="dim" style={{ fontSize: 20 }}>＋</span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('log.recogHint')}</p>
            </>
          )}
        </div>
      )}

      {/* 常用：最近 5 + 更多 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={'chip' + (pickTab === 'food' ? ' active' : '')} onClick={() => setPickTab('food')}>{t('log.freqFoods')}</button>
            <button className={'chip' + (pickTab === 'meal' ? ' active' : '')} onClick={() => setPickTab('meal')}>{t('log.myMeals')}</button>
          </div>
          {tabItems.length > 0 && (
            <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => { setQuery(''); setManageLib(false); setLibraryOpen(true) }}>
              {t('log.more')} ({tabItems.length}) ›
            </button>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="empty">{pickTab === 'food' ? t('log.noFreqFood') : t('log.noFreqMeal')}<br />{t('log.saveHint')}</div>
        ) : (
          recent.map((item) => (
            <div key={item.id} className="list-row" style={{ padding: '14px 0' }}>
              <button onClick={() => fillFrom(item)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}{item.brand && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {item.brand}</span>}<span className="muted" style={{ fontWeight: 400 }}> · {item.baseAmount}{unitLabel(item.unit)}</span></div>
                <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{macroLine(item.calories, item.protein, item.carbs, item.fat)}</div>
              </button>
              <span className="dim" style={{ fontSize: 20 }}>＋</span>
            </div>
          ))
        )}
      </div>

      {edit?.kind === 'meal' && <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 12px', textAlign: 'center' }}>{t('log.editMeal')}</p>}
      {edit?.kind === 'saved' && <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 12px', textAlign: 'center' }}>{t('log.editing')}</p>}

      {/* 餐次（编辑常用项时隐藏） */}
      {edit?.kind !== 'saved' && (
        <div className="card">
          <p className="card-label">{t('log.mealType')}</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {MEAL_TYPES.map((mt) => (
              <button key={mt} onClick={() => setType(mt)} className="chip" style={{ flex: 1, justifyContent: 'center', background: type === mt ? 'var(--surface-2)' : 'var(--surface)', color: type === mt ? 'var(--accent)' : 'var(--text)', borderColor: type === mt ? 'var(--accent)' : 'var(--line)', fontWeight: type === mt ? 600 : 400 }}>{t('meal.' + mt)}</button>
            ))}
          </div>
        </div>
      )}

      {/* 表单 */}
      <div className="card">
        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t('log.foodName')}</label>
          <input placeholder={t('log.foodNamePh')} value={name} onChange={(e) => { setName(e.target.value); setLookupMsg(null) }} />
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label>{t('log.brand')}</label>
          <input placeholder={t('log.brandPh')} value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button className="chip" onClick={lookupName} disabled={looking || !name.trim()} style={{ padding: '7px 14px', fontSize: 13, opacity: !name.trim() ? 0.5 : 1 }}>⌕ {looking ? t('log.looking') : t('log.lookup')}</button>
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
              <button key={u} onClick={() => setUnit(u)} className="chip" style={{ flex: 1, justifyContent: 'center', padding: '10px 4px', background: unit === u ? 'var(--surface-2)' : 'var(--surface)', color: unit === u ? 'var(--accent)' : 'var(--text)', borderColor: unit === u ? 'var(--accent)' : 'var(--line)', fontWeight: unit === u ? 600 : 400 }}>{unitLabel(u)}</button>
            ))}
          </div>
        </div>

        {quickAmounts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, margin: '4px 0 20px', flexWrap: 'wrap' }}>
            {quickAmounts.map((a) => <button key={a} className={'chip' + (+amount === a ? ' active' : '')} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => changeAmount(String(a))}>{a}{unitLabel(unit)}</button>)}
          </div>
        )}
        {base.current && <p className="muted" style={{ fontSize: 12, margin: '-6px 0 16px', color: 'var(--accent)' }}>{t('log.scaleHint')}</p>}

        <div className="row">
          <div className="field"><label>{t('log.proteinG')}</label><input type="number" inputMode="decimal" placeholder="0" value={protein} onChange={(e) => editMacro(setProtein, e.target.value)} /></div>
          <div className="field"><label>{t('log.carbsG')}</label><input type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={(e) => editMacro(setCarbs, e.target.value)} /></div>
        </div>
        <div className="row">
          <div className="field"><label>{t('log.fatG')}</label><input type="number" inputMode="decimal" placeholder="0" value={fat} onChange={(e) => editMacro(setFat, e.target.value)} /></div>
          <div className="field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{t('settings.energy')}</span><EnergyToggle /></label>
            <input type="number" inputMode="decimal" placeholder={autoCal ? String(toEnergy(autoCal)) : '0'} value={calories === '' ? '' : toEnergy(+calories)} onChange={(e) => editCalories(e.target.value)} />
          </div>
        </div>

        {edit === null && (
          <button onClick={() => setSaveToLib((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '4px 0', color: saveToLib ? 'var(--accent)' : 'var(--text-dim)' }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, border: '1px solid ' + (saveToLib ? 'var(--accent)' : 'var(--line-strong)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, background: saveToLib ? 'var(--accent)' : 'transparent', color: '#1a1206' }}>{saveToLib ? '✓' : ''}</span>
            <span style={{ fontSize: 14 }}>{pickTab === 'food' ? t('log.saveToFreqFood') : t('log.saveToFreqMeal')}<span className="muted" style={{ fontSize: 12 }}>{t('log.saveBasis')}</span></span>
          </button>
        )}
      </div>

      {/* 动作区 */}
      <div className="row">
        <button className="btn" onClick={() => (edit ? cancelEdit() : navigate(-1))}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={savePrimary} disabled={!name.trim()}>
          {edit?.kind === 'saved' ? t('log.updateSaved') : edit?.kind === 'meal' ? t('log.updateMeal') : t('log.saveRecord')}
        </button>
      </div>

      {/* 今日已记录（点可编辑） */}
      {edit === null && todayMeals.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="card-label">{t('log.loggedToday')}</p>
          {todayMeals.map((m) => (
            <div key={m.id} className="list-row">
              <button onClick={() => startEditMeal(m)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}{m.brand && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {m.brand}</span>}{m.amount ? <span className="muted" style={{ fontWeight: 400 }}> · {m.amount}{unitLabel(m.unit ?? '')}</span> : null}</div>
                <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{t('meal.' + m.type)} · {macroLine(m.calories, m.protein, m.carbs, m.fat)}</div>
              </button>
              <span className="dim" style={{ fontSize: 13, marginRight: 4 }}>{t('log.edit')} ›</span>
              <button className="btn-ghost" aria-label="delete" style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }} onClick={() => deleteMeal(m.id)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* 全部常用（全屏搜索/管理） */}
      {libraryOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)' }}>
          <div style={{ maxWidth: 460, margin: '0 auto', height: '100%', display: 'flex', flexDirection: 'column', padding: 'calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <button className="btn-ghost" style={{ padding: 6, fontSize: 20 }} onClick={() => setLibraryOpen(false)}>‹</button>
              <input placeholder={t('log.searchPh')} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus style={{ flex: 1, padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', outline: 'none' }} />
              <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setManageLib((v) => !v)}>{manageLib ? t('common.done') : t('common.manage')}</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <p className="card-label" style={{ marginBottom: 4 }}>{t('log.allSaved')} · {t(pickTab === 'food' ? 'log.freqFoods' : 'log.myMeals')}</p>
              {searched.length === 0 ? (
                <div className="empty">{query.trim() ? t('log.noMatch') : t('log.noFreqFood')}</div>
              ) : (
                searched.map((item) => (
                  <div key={item.id} className="list-row" style={{ padding: '14px 0' }}>
                    <button onClick={() => (manageLib ? startEditSaved(item) : (fillFrom(item), setLibraryOpen(false)))} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}{item.brand && <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}> · {item.brand}</span>}<span className="muted" style={{ fontWeight: 400 }}> · {item.baseAmount}{unitLabel(item.unit)}</span></div>
                      <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{macroLine(item.calories, item.protein, item.carbs, item.fat)}</div>
                    </button>
                    {manageLib ? (
                      <>
                        <span className="dim" style={{ fontSize: 13, marginRight: 4 }}>{t('log.edit')} ›</span>
                        <button className="btn-ghost" style={{ color: 'var(--protein)', fontSize: 20, padding: 6 }} onClick={() => deleteSavedItem(item.id)} aria-label="delete">−</button>
                      </>
                    ) : <span className="dim" style={{ fontSize: 20 }}>＋</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
