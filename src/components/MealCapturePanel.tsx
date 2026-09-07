import { lazy, Suspense, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { setPendingPhoto } from '../lib/photoHandoff'
import AppIcon from './AppIcon'

const VoiceMealSheet = lazy(() => import('./VoiceMealSheet'))

// Keep capture flows separate from coaching and favorite selection.
export default function MealCapturePanel() {
  const navigate = useNavigate()
  const { t, lang } = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [voiceOpen, setVoiceOpen] = useState(false)

  // Open the picker inside the user gesture, then hand the file to the photo route.
  function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingPhoto(file)
    navigate('/capture', { state: { mode: 'photo', returnTo: '/' } })
  }

  return (
    <>
      <div className="section-title">
        <strong>{t('today.logThisMeal')}</strong>
        <span className="muted" style={{ fontSize: 11 }}>{t('today.aiAssisted')}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoPicked} style={{ display: 'none' }} />
      <div className="capture-grid">
        <button className="capture-tile voice" type="button" onClick={() => setVoiceOpen(true)} aria-label={t('today.voiceLog')}>
          <span className="capture-icon"><AppIcon name="mic" size={22} /></span>
          <strong>{t('today.voiceLog')}</strong>
          <span>{t('today.voiceSub')}</span>
        </button>
        <button className="capture-tile photo" type="button" onClick={() => fileRef.current?.click()} aria-label={t('today.photoScan')}>
          <span className="capture-icon"><AppIcon name="camera" size={22} /></span>
          <strong>{t('today.photoScan')}</strong>
          <span>{t('today.photoSub')}</span>
        </button>
      </div>
      <button className="capture-manual" type="button" onClick={() => navigate('/log', { state: { returnTo: '/' } })}>
        <AppIcon name="pencil" size={18} />
        {t('today.manualEntry')}
      </button>
      {voiceOpen && <Suspense fallback={<p role="status">{lang === 'zh' ? '加载中…' : 'Loading…'}</p>}><VoiceMealSheet onClose={() => setVoiceOpen(false)} /></Suspense>}
    </>
  )
}
