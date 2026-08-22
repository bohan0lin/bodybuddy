import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { estimateCalories, round1, scale, todayStr } from '../lib/nutrition'
import { postJson } from '../lib/api'
import { fileToResizedBase64 } from '../lib/image'
import { MEAL_LABELS, MEAL_TYPES, type MealType, type SavedItem, type SavedKind } from '../types'

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

const UNITS = ['g', '份', 'ml', '个', '勺']

export default function LogMeal() {
  const { addMeal, meals, deleteMeal, savedItems, addSavedItem, deleteSavedItem } = useStore()
  const navigate = useNavigate()
  const today = todayStr()

  const [type, setType] = useState<MealType>(guessMealType())
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('g')
  const [amount, setAmount] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [calories, setCalories] = useState('')

  // 选中的常用食物基准：分量换算的参照。手动改营养值时清空（脱离换算）。
  const base = useRef<{ amount: number; p: number; c: number; f: number; cal: number } | null>(null)

  const [pickTab, setPickTab] = useState<SavedKind>('food')
  const [manageMode, setManageMode] = useState(false)
  const [saveToLib, setSaveToLib] = useState(false)

  // 拍照识别
  const fileRef = useRef<HTMLInputElement>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [recogItems, setRecogItems] = useState<RecogItem[]>([])
  const [recogError, setRecogError] = useState<string | null>(null)

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

  // 填入表单并激活分量换算（基准=该分量）
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

  // 选中常用项
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

  // 拍照 → 压缩 → Claude 识别 → 填表
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 允许重复选同一张
    if (!file) return
    setRecognizing(true)
    setRecogError(null)
    setRecogItems([])
    try {
      const { data, mediaType } = await fileToResizedBase64(file)
      const { items } = await postJson<{ items: RecogItem[] }>('/api/recognize', { image: data, mediaType })
      if (!items.length) setRecogError('没识别出食物，换个角度或光线再拍试试')
      else {
        setRecogItems(items)
        fillForm(items[0])
      }
    } catch (err) {
      setRecogError(err instanceof Error ? err.message : '识别失败')
    } finally {
      setRecognizing(false)
    }
  }

  // 改分量 → 按基准自动换算营养
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

  // 手动修改营养值 → 脱离换算
  function editMacro(setter: (v: string) => void, val: string) {
    base.current = null
    setter(val)
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
      addSavedItem({
        kind: pickTab,
        name: name.trim(),
        unit,
        baseAmount: amt ?? 1,
        protein: p,
        carbs: c,
        fat: f,
        calories: cal,
      })
    }
    navigate('/')
  }

  // 快捷倍数：0.5 / 1 / 1.5 / 2 倍基准分量
  const quickAmounts = base.current
    ? [0.5, 1, 1.5, 2].map((k) => round1(base.current!.amount * k))
    : []

  return (
    <div className="page">
      {/* 拍照识别 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhoto}
        style={{ display: 'none' }}
      />
      <button
        className="card"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', textAlign: 'left' }}
        onClick={() => fileRef.current?.click()}
        disabled={recognizing}
      >
        <span style={{ fontSize: 24 }}>◐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{recognizing ? '识别中…' : '拍照识别食物'}</div>
          <div className="muted" style={{ fontSize: 12 }}>{recognizing ? 'AI 正在分析图片' : 'AI 估算营养并自动填入'}</div>
        </div>
        <span className="dim">›</span>
      </button>

      {/* 识别结果 */}
      {(recogItems.length > 0 || recogError) && (
        <div className="card">
          <p className="card-label">识别结果</p>
          {recogError ? (
            <div className="empty">{recogError}</div>
          ) : (
            <>
              {recogItems.map((it, i) => (
                <div key={i} className="list-row" style={{ padding: '12px 0' }}>
                  <button onClick={() => fillForm(it)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                      <span className="muted" style={{ fontWeight: 400 }}> · {it.amount}{it.unit}</span>
                    </div>
                    <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {it.calories} 千卡 · 蛋 {it.protein} 碳 {it.carbs} 脂 {it.fat}
                    </div>
                  </button>
                  <span className="dim" style={{ fontSize: 20 }}>＋</span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>点任意一项填入下方，可再微调分量</p>
            </>
          )}
        </div>
      )}

      {/* 常用快捷选择 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={'chip' + (pickTab === 'food' ? ' active' : '')} onClick={() => setPickTab('food')}>
              常用食物
            </button>
            <button className={'chip' + (pickTab === 'meal' ? ' active' : '')} onClick={() => setPickTab('meal')}>
              我的套餐
            </button>
          </div>
          {picks.length > 0 && (
            <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setManageMode((v) => !v)}>
              {manageMode ? '完成' : '管理'}
            </button>
          )}
        </div>

        {picks.length === 0 ? (
          <div className="empty">
            还没有常用{pickTab === 'food' ? '食物' : '套餐'}
            <br />
            在下方填写后勾选「保存到常用」即可
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {picks.map((item) => (
              <div key={item.id} className="list-row" style={{ padding: '14px 0' }}>
                <button onClick={() => !manageMode && fillFrom(item)} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                    <span className="muted" style={{ fontWeight: 400 }}> · {item.baseAmount}{item.unit}</span>
                  </div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {item.calories} 千卡 · 蛋 {item.protein} 碳 {item.carbs} 脂 {item.fat}
                    {item.note ? ` · ${item.note}` : ''}
                  </div>
                </button>
                {manageMode ? (
                  <button
                    className="btn-ghost"
                    style={{ color: 'var(--protein)', fontSize: 20, padding: 6 }}
                    onClick={() => deleteSavedItem(item.id)}
                    aria-label="删除"
                  >
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
        <p className="card-label">餐次</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {MEAL_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="chip"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: type === t ? 'var(--text)' : 'var(--surface)',
                color: type === t ? '#111' : 'var(--text)',
                borderColor: type === t ? 'var(--text)' : 'var(--line)',
                fontWeight: type === t ? 600 : 400,
              }}
            >
              {MEAL_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* 手动填写 */}
      <div className="card">
        <div className="field">
          <label>食物名称</label>
          <input placeholder="例如：鸡胸肉" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* 分量 */}
        <div className="field">
          <label>分量</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="100"
            value={amount}
            onChange={(e) => changeAmount(e.target.value)}
          />
        </div>

        {/* 单位 —— 胶囊分段选择（替代下拉框） */}
        <div className="field">
          <label>单位</label>
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
                  background: unit === u ? 'var(--text)' : 'var(--surface)',
                  color: unit === u ? '#111' : 'var(--text)',
                  borderColor: unit === u ? 'var(--text)' : 'var(--line)',
                  fontWeight: unit === u ? 600 : 400,
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* 快捷分量：基于选中常用食物的基准倍数 */}
        {quickAmounts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, margin: '-4px 0 20px', flexWrap: 'wrap' }}>
            {quickAmounts.map((a) => (
              <button
                key={a}
                className={'chip' + (+amount === a ? ' active' : '')}
                style={{ padding: '6px 12px', fontSize: 13 }}
                onClick={() => changeAmount(String(a))}
              >
                {a}
                {unit}
              </button>
            ))}
          </div>
        )}

        {base.current && (
          <p className="muted" style={{ fontSize: 12, margin: '-10px 0 16px', color: 'var(--accent)' }}>
            营养值随分量自动换算 · 手动修改下方数值即可自定义
          </p>
        )}

        <div className="row">
          <div className="field">
            <label>蛋白 (g)</label>
            <input type="number" inputMode="decimal" placeholder="0" value={protein} onChange={(e) => editMacro(setProtein, e.target.value)} />
          </div>
          <div className="field">
            <label>碳水 (g)</label>
            <input type="number" inputMode="decimal" placeholder="0" value={carbs} onChange={(e) => editMacro(setCarbs, e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>脂肪 (g)</label>
            <input type="number" inputMode="decimal" placeholder="0" value={fat} onChange={(e) => editMacro(setFat, e.target.value)} />
          </div>
          <div className="field">
            <label>热量 (千卡)</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder={autoCal ? `自动 ${autoCal}` : '0'}
              value={calories}
              onChange={(e) => editMacro(setCalories, e.target.value)}
            />
          </div>
        </div>

        {/* 保存到常用 */}
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
            保存到常用{pickTab === 'food' ? '食物' : '套餐'}
            <span className="muted" style={{ fontSize: 12 }}>（按此分量为基准）</span>
          </span>
        </button>
      </div>

      <div className="row">
        <button className="btn" onClick={() => navigate(-1)}>取消</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
          保存记录
        </button>
      </div>

      {/* 今日已记录 */}
      {todayMeals.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="card-label">今日已记录</p>
          {todayMeals.map((m) => {
            const saved = savedMealNames.has(m.name)
            return (
              <div key={m.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                    {m.amount ? <span className="muted" style={{ fontWeight: 400 }}> · {m.amount}{m.unit}</span> : null}
                  </div>
                  <div className="num" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    {MEAL_LABELS[m.type as MealType]} · {m.calories} 千卡 · 蛋 {m.protein} 碳 {m.carbs} 脂 {m.fat}
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  title={saved ? '已在常用' : '收藏为套餐'}
                  style={{ fontSize: 18, padding: 6, color: saved ? 'var(--accent)' : 'var(--text-muted)' }}
                  onClick={() =>
                    addSavedItem({
                      kind: 'meal',
                      name: m.name,
                      unit: m.unit ?? '份',
                      baseAmount: m.amount ?? 1,
                      protein: m.protein,
                      carbs: m.carbs,
                      fat: m.fat,
                      calories: m.calories,
                    })
                  }
                >
                  {saved ? '★' : '☆'}
                </button>
                <button
                  className="btn-ghost"
                  aria-label="删除"
                  style={{ fontSize: 20, padding: 6, color: 'var(--text-muted)' }}
                  onClick={() => deleteMeal(m.id)}
                >
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
