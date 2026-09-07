import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { createVoiceController, type Recognition, type VoiceState } from '../lib/voice'
import { postJson } from '../lib/api'
import { combineFoods, type FoodDraft } from '../lib/foodEntry'
import { todayStr } from '../lib/nutrition'
import { FoodEntryEditor } from '../pages/LogMeal'

type BrowserRecognition = Recognition & { lang: string; continuous: boolean; interimResults: boolean }
type SpeechWindow = Window & { SpeechRecognition?: new () => BrowserRecognition; webkitSpeechRecognition?: new () => BrowserRecognition }

export default function VoiceMealSheet({ onClose }: { onClose: () => void }) {
  const { lang } = useT()
  const zh = lang === 'zh'
  const [text, setText] = useState('')
  const [state, setState] = useState<VoiceState>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [food, setFood] = useState<FoodDraft | null>(null)
  const controller = useMemo(() => createVoiceController(setState, setText), [])
  const request = useRef<AbortController | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const speechWindow = window as SpeechWindow
  const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  useEffect(() => {
    dialog.current?.showModal()
    return () => { controller.dispose(); request.current?.abort() }
  }, [controller])
  function record() {
    if (state === 'listening') { controller.stop(); return }
    if (!Speech) return
    const recognition = new Speech()
    recognition.lang = zh ? 'zh-CN' : 'en-US'
    recognition.continuous = false; recognition.interimResults = false
    controller.start(recognition)
  }
  async function recognize() {
    if (request.current || !text.trim()) return
    const abort = new AbortController(); request.current = abort
    setBusy(true); setError('')
    try {
      const response = await postJson<{ reply: string; actions: (FoodDraft & { type: string })[] }>('/api/assistant', {
        messages: [{ role: 'user', text: `Prepare meal log actions for this food description. Do not save favorites or workouts. The user will review before recording: ${text}` }],
        date: todayStr(), hour: new Date().getHours(), lang,
      }, abort.signal)
      if (abort.signal.aborted) return
      const draft = combineFoods(response.actions.filter((action) => action.type === 'log').map((action) => ({ ...action, amount: action.amount ?? 1, unit: action.unit ?? 'serving' })))
      if (!draft) throw new Error(zh ? '请补充食物名称和份量后重试。' : 'Add the food name and amount, then try again.')
      setFood(draft)
    } catch (err) { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Request failed.') }
    finally { request.current = null; if (!abort.signal.aborted) setBusy(false) }
  }
  return <dialog ref={dialog} className="voice-meal-sheet" aria-labelledby="voice-meal-title" onCancel={onClose}>
    <div className="voice-meal-content">
      <header className="food-entry-header"><h2 id="voice-meal-title">{zh ? '语音记录' : 'Voice log'}</h2>
        <button className="btn-ghost" onClick={onClose} aria-label={zh ? '关闭' : 'Close'}>×</button></header>
      {food ? <FoodEntryEditor initial={food} onDone={onClose} onCancel={() => setFood(null)} /> : <>
        <p className="muted">{zh ? '说说吃了什么、吃了多少，确认后再记录。' : 'Describe what you ate and how much. Review before recording.'}</p>
        {Speech ? <button className={`btn${state === 'listening' ? ' btn-primary' : ''}`} disabled={busy || state === 'processing'} onClick={record}>
          {state === 'listening' ? (zh ? '停止录音' : 'Stop recording') : (zh ? '开始录音' : 'Start recording')}</button>
          : <p className="muted">{zh ? '此浏览器不支持语音，请在下面输入描述。' : 'Voice is unavailable in this browser. Type your description below.'}</p>}
        <p role="status">{state === 'listening' ? (zh ? '正在聆听…' : 'Listening…') : state === 'processing' ? (zh ? '正在转写…' : 'Transcribing…') : state === 'error' ? (zh ? '录音失败，请检查麦克风权限或输入描述。' : 'Recording failed. Check microphone access or type below.') : ''}</p>
        <textarea aria-label={zh ? '食物描述' : 'Food description'} value={text} disabled={busy} maxLength={7000}
          onChange={(e) => setText(e.target.value)} placeholder={zh ? '例如：一碗米饭、150克鸡胸肉' : 'For example: a bowl of rice and 150 g chicken'} />
        {error && <p className="food-error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !text.trim() || state === 'listening' || state === 'processing'} onClick={recognize}>
          {busy ? (zh ? '正在整理…' : 'Preparing…') : (zh ? '查看营养结果' : 'Review nutrition')}</button>
      </>}
    </div>
  </dialog>
}
