import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useT } from '../lib/i18n'
import { todayStr } from '../lib/nutrition'
import { postJson } from '../lib/api'
import { fileToResizedBase64 } from '../lib/image'
import { peekPendingPhoto, takePendingPhoto } from '../lib/photoHandoff'
import { combineFoods, recordFoodEntry, scaleFood, uploadFoodPhoto, type FoodDraft } from '../lib/foodEntry'
import { supabase } from '../lib/supabase'
import FoodPhoto from '../components/FoodPhoto'
import { MEAL_TYPES, type Meal, type MealType, type SavedItem } from '../types'

const blank: FoodDraft = { name: '', amount: 1, unit: 'serving', calories: 0, carbs: 0, protein: 0, fat: 0 }
const guessType = (): MealType => { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack' }

export function FoodEntryEditor({ initial, photo, date, editMeal, editSaved, onDone, onCancel }: {
  initial: FoodDraft; photo?: string; date?: string; editMeal?: Meal; editSaved?: SavedItem; onDone: () => void; onCancel: () => void
}) {
  const { lang, t } = useT()
  const zh = lang === 'zh'
  const { reload } = useStore()
  const [food, setFood] = useState(initial)
  const [base, setBase] = useState(initial)
  const [type, setType] = useState<MealType>(editMeal?.type ?? guessType())
  const [calibrating, setCalibrating] = useState(!initial.name)
  const [favorite, setFavorite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cover, setCover] = useState(photo)
  const uploaded = useRef<string | undefined>(undefined)
  const id = useRef(editMeal?.id ?? crypto.randomUUID())
  const saving = useRef(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const valid = food.name.trim().length > 0 && food.name.length <= 200 && food.unit.trim().length > 0
    && Number.isFinite(food.amount) && food.amount > 0 && food.amount <= 20000
    && (['protein', 'carbs', 'fat', 'calories'] as const).every((key) => Number.isFinite(food[key]) && food[key] >= 0 && food[key] <= (key === 'calories' ? 20000 : 2000))

  async function save() {
    if (saving.current || !valid) return
    saving.current = true; setBusy(true); setError('')
    try {
      let path = cover
      if (cover?.startsWith('data:')) {
        uploaded.current ??= await uploadFoodPhoto(cover)
        path = uploaded.current
      }
      if (editSaved) {
        const { error } = await supabase.from('saved_items').update({ name: food.name.trim(), brand: food.brand || null,
          unit: food.unit, base_amount: food.amount, protein: food.protein, carbs: food.carbs,
          fat: food.fat, calories: food.calories, photo_url: path ?? null }).eq('id', editSaved.id).select('id').single()
        if (error) throw error
      } else {
        await recordFoodEntry(id.current, { ...food, name: food.name.trim(), type, date: editMeal?.date ?? date ?? todayStr(), photoUrl: path }, favorite)
      }
      onDone(); reload()
    } catch {
      setError(zh ? '保存失败，请重试。当前内容已保留。' : 'Could not save. Your changes are still here. Please retry.')
    } finally { saving.current = false; setBusy(false) }
  }

  return <div className="food-editor">
    {cover && <FoodPhoto path={cover} alt={food.name || (zh ? '食物照片' : 'Food photo')} className="food-hero" />}
    {editSaved && <>
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={async (e) => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
        setBusy(true)
        try { const image = await fileToResizedBase64(file); setCover(`data:${image.mediaType};base64,${image.data}`); uploaded.current = undefined }
        catch { setError(zh ? '无法读取图片，请选择 JPEG、PNG 或 WebP。' : 'Cannot read this image. Choose JPEG, PNG or WebP.') }
        finally { setBusy(false) }
      }} />
      <button className="btn" disabled={busy} onClick={() => photoInput.current?.click()}>{zh ? '更换收藏封面' : 'Change favorite photo'}</button>
    </>}
    <div className="card food-summary">
      <p className="eyebrow">{editSaved ? (zh ? '收藏食物' : 'FAVORITE FOOD') : (zh ? '确认这一餐' : 'REVIEW YOUR MEAL')}</p>
      <h2>{food.name || (zh ? '填写食物信息' : 'Add food details')}</h2>
      <label className="food-amount">{zh ? '份量' : 'Amount'}
        <input aria-label={zh ? '份量' : 'Amount'} type="number" min="0.1" step="any" value={food.amount || ''} disabled={busy}
          onChange={(e) => setFood(base.amount > 0 ? scaleFood({ ...base, name: food.name, brand: food.brand, unit: food.unit }, Number(e.target.value)) : { ...food, amount: Number(e.target.value) })} />
        <span>{food.unit === 'serving' || food.unit === '份' ? (zh ? '份' : 'serving') : food.unit}</span>
      </label>
      <div className="food-energy"><strong className="num">{Math.round(food.calories)}</strong><span>kcal</span></div>
      <div className="food-macros">{(['carbs', 'protein', 'fat'] as const).map((key) => <div key={key}>
        <span>{t(`macro.${key}`)}</span><strong className="num">{Math.round(food[key] * 10) / 10}<small> g</small></strong>
      </div>)}</div>
    </div>
    {!editSaved && <div className="food-meal-types">{MEAL_TYPES.map((mt) => <button key={mt} disabled={busy}
      className={`chip${mt === type ? ' active' : ''}`} onClick={() => setType(mt)}>{t(`meal.${mt}`)}</button>)}</div>}
    {calibrating && <fieldset className="card food-calibration" disabled={busy}>
      <legend>{zh ? '校准营养数据' : 'Calibrate nutrition'}</legend>
      <label className="field">{zh ? '食物名称' : 'Food name'}<input value={food.name} maxLength={200} onChange={(e) => setFood({ ...food, name: e.target.value })} /></label>
      <label className="field">{zh ? '品牌（可选）' : 'Brand (optional)'}<input value={food.brand ?? ''} onChange={(e) => setFood({ ...food, brand: e.target.value })} /></label>
      <label className="field">{zh ? '单位' : 'Unit'}<input value={food.unit} maxLength={30} onChange={(e) => setFood({ ...food, unit: e.target.value })} /></label>
      <div className="food-calibration-grid">{(['calories', 'carbs', 'protein', 'fat'] as const).map((key) => <label className="field" key={key}>
        {key === 'calories' ? (zh ? '热量 (kcal)' : 'Calories (kcal)') : `${t(`macro.${key}`)} (g)`}
        <input type="number" min="0" step="any" value={food[key]} onChange={(e) => setFood({ ...food, [key]: Number(e.target.value) })} />
      </label>)}</div>
      <button className="btn" disabled={!valid} onClick={() => { setBase(food); setCalibrating(false) }}>{zh ? '保存校准' : 'Apply calibration'}</button>
    </fieldset>}
    {!editSaved && <label className="food-favorite"><input type="checkbox" checked={favorite} disabled={busy} onChange={(e) => setFavorite(e.target.checked)} />
      {zh ? '保存到快捷食物' : 'Save to favorites'}{cover ? (zh ? '（包含照片）' : ' with photo') : ''}</label>}
    {error && <p role="alert" className="food-error">{error}</p>}
    <div className="row food-actions">
      <button className="btn" disabled={busy} onClick={() => setCalibrating(true)}>{zh ? '校准' : 'Calibrate'}</button>
      <button className="btn btn-primary" disabled={busy || !valid || calibrating} onClick={save}>{busy ? (zh ? '保存中…' : 'Saving…') : editSaved || editMeal ? (zh ? '保存修改' : 'Save changes') : (zh ? '记录' : 'Log meal')}</button>
    </div>
    <button className="btn-ghost food-back" disabled={busy} onClick={onCancel}>{t('common.cancel')}</button>
    {editSaved && <button className="btn-ghost food-back" disabled={busy} onClick={async () => {
      if (!window.confirm(zh ? '移除此收藏？已有的饮食记录会保留。' : 'Remove this favorite? Existing meal records will remain.')) return
      setBusy(true); setError('')
      try {
        const { error } = await supabase.from('saved_items').delete().eq('id', editSaved.id).select('id').single()
        if (error) throw error
        onDone(); reload()
      } catch { setError(zh ? '删除失败，请重试。' : 'Could not remove favorite. Please retry.') }
      finally { setBusy(false) }
    }}>{zh ? '移除收藏' : 'Remove favorite'}</button>}
  </div>
}

export default function LogMeal() {
  const { lang, t } = useT()
  const zh = lang === 'zh'
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { editMeal?: Meal; logDate?: string; returnTo?: string; mode?: string } | null
  const photoMode = location.pathname === '/capture' || state?.mode === 'photo'
  const { savedItems } = useStore()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<SavedItem | null>(null)
  const [editingSaved, setEditingSaved] = useState(false)
  const [file, setFile] = useState<File | null>(() => photoMode ? peekPendingPhoto() : null)
  const [photo, setPhoto] = useState('')
  const [result, setResult] = useState<FoodDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const done = () => navigate(state?.returnTo ?? '/')
  useEffect(() => { if (photoMode && file === peekPendingPhoto()) takePendingPhoto() }, [photoMode, file])
  useEffect(() => {
    if (!file) return
    const controller = new AbortController()
    // Synchronize the visible status with this abortable file-processing request.
    // oxlint-disable-next-line react/set-state-in-effect
    setBusy(true); setError(''); setResult(null); setPhoto('')
    void (async () => {
      try {
        const image = await fileToResizedBase64(file)
        if (controller.signal.aborted) return
        setPhoto(`data:${image.mediaType};base64,${image.data}`)
        const response = await postJson<{ items: FoodDraft[] }>('/api/recognize', { image: image.data, mediaType: image.mediaType, lang }, controller.signal)
        if (controller.signal.aborted) return
        const combined = combineFoods(response.items)
        if (!combined) throw new Error(zh ? '没有识别到食物，请重拍或填写营养数据。' : 'No food found. Retake the photo or enter its nutrition.')
        setResult(combined)
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : t('log.recogEmpty')) }
      finally { if (!controller.signal.aborted) setBusy(false) }
    })()
    return () => controller.abort()
  }, [file, retry, lang, zh, t])

  const edit = state?.editMeal
  const initial = edit ? { ...edit, amount: edit.amount ?? 1, unit: edit.unit ?? 'serving' }
    : picked ? { ...picked, amount: picked.baseAmount } : result
  const matches = savedItems.filter((s) => `${s.name} ${s.brand ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="page food-entry-page">
    <header className="food-entry-header"><button className="btn-ghost" onClick={done}>‹ {zh ? '返回' : 'Back'}</button>
      <h1>{edit ? (zh ? '编辑记录' : 'Edit meal') : photoMode ? (zh ? '拍照识别' : 'Photo log') : (zh ? '快捷输入' : 'Quick entry')}</h1></header>
    {state?.logDate && <p className="muted">{state.logDate}</p>}
    {photoMode && <>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setFile(f) }} />
      {!result && photo && <FoodPhoto path={photo} alt={zh ? '食物照片' : 'Food photo'} className="food-hero" />}
      {!file && <div className="card empty"><p>{zh ? '拍下这一餐，确认营养后记录。' : 'Photograph your meal, review its nutrition, then log it.'}</p></div>}
      <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{file ? (zh ? '重拍 / 换图' : 'Retake / choose another') : (zh ? '拍照 / 选择照片' : 'Take / choose photo')}</button>
      {busy && <p role="status" className="food-status">{zh ? '正在识别食物与营养…' : 'Recognizing food and nutrition…'}</p>}
      {error && <div className="card"><p role="alert" className="food-error">{error}</p><div className="row">
        <button className="btn" onClick={() => setRetry((n) => n + 1)}>{zh ? '重新识别' : 'Retry recognition'}</button>
        {photo && <button className="btn" onClick={() => { setResult({ ...blank }); setError('') }}>{zh ? '填写营养数据' : 'Enter nutrition'}</button>}
      </div></div>}
    </>}
    {!photoMode && !edit && !picked && <>
      <p className="muted">{zh ? '从收藏中选择，调整份量即可记录。' : 'Choose a favorite and adjust the amount.'}</p>
      <input className="food-search" aria-label={zh ? '搜索收藏食物' : 'Search favorites'} placeholder={zh ? '搜索食物或品牌' : 'Search foods or brands'} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="card food-library">{matches.map((item) => <div className="food-saved-row" key={item.id}>
        <button className="food-saved-pick" onClick={() => { setPicked(item); setEditingSaved(false) }}><FoodPhoto path={item.photoUrl} alt={item.name} />
          <span><strong>{item.name}</strong><small>{item.baseAmount} {item.unit} · {Math.round(item.calories)} kcal</small></span><span aria-hidden="true">＋</span></button>
        <button className="btn-ghost" aria-label={`${zh ? '编辑' : 'Edit'} ${item.name}`} onClick={() => { setPicked(item); setEditingSaved(true) }}>{zh ? '编辑' : 'Edit'}</button>
      </div>)}
      {!savedItems.length ? <div className="empty">{zh ? '还没有收藏的食物' : 'No favorites yet'}<p>{zh ? '拍照记录时，勾选保存到快捷食物。' : 'Save a food to favorites when you log a photo.'}</p>
        <button className="btn btn-primary" onClick={() => navigate('/capture', { state })}>{zh ? '拍照添加' : 'Add a food photo'}</button></div>
        : !matches.length && <p className="empty">{zh ? '没有匹配的食物' : 'No matching foods'}</p>}
      </div>
    </>}
    {initial && <FoodEntryEditor key={`${picked?.id ?? edit?.id ?? 'photo'}-${retry}-${photo}`} initial={initial}
      photo={edit?.photoUrl ?? picked?.photoUrl ?? (photo || undefined)} date={state?.logDate} editMeal={edit}
      editSaved={editingSaved ? picked ?? undefined : undefined} onDone={done}
      onCancel={() => { if (picked) { setPicked(null); setEditingSaved(false) } else done() }} />}
  </div>
}
