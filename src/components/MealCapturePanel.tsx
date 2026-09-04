import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { setPendingPhoto } from '../lib/photoHandoff'
import AppIcon from './AppIcon'

// 记录这一餐：语音 / 拍照 / 手动 三个入口，接到既有流程
export default function MealCapturePanel() {
  const navigate = useNavigate()
  const { t } = useT()
  const fileRef = useRef<HTMLInputElement>(null)

  // 拍照识别：本次点击即打开相机/相册（浏览器要求的用户手势），选好图后手递给 /log 识别
  function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return // 取消选择：留在主页，无错误
    setPendingPhoto(file)
    navigate('/log', { state: { mode: 'photo', returnTo: '/' } })
  }

  return (
    <>
      <div className="section-title">
        <strong>{t('today.logThisMeal')}</strong>
        <span className="muted" style={{ fontSize: 11 }}>{t('today.aiAssisted')}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPhotoPicked} style={{ display: 'none' }} />
      <div className="capture-grid">
        <button className="capture-tile voice" type="button" onClick={() => navigate('/coach', { state: { mode: 'voice-meal', returnTo: '/' } })} aria-label={t('today.voiceLog')}>
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
    </>
  )
}
