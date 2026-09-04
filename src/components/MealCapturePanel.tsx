import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import AppIcon from './AppIcon'

// 记录这一餐：语音 / 拍照 / 手动 三个入口，接到既有流程
export default function MealCapturePanel() {
  const navigate = useNavigate()
  const { t } = useT()
  return (
    <>
      <div className="section-title">
        <strong>{t('today.logThisMeal')}</strong>
        <span className="muted" style={{ fontSize: 11 }}>{t('today.aiAssisted')}</span>
      </div>
      <div className="capture-grid">
        <button className="capture-tile voice" type="button" onClick={() => navigate('/coach')} aria-label={t('today.voiceLog')}>
          <span className="capture-icon"><AppIcon name="mic" size={22} /></span>
          <strong>{t('today.voiceLog')}</strong>
          <span>{t('today.voiceSub')}</span>
        </button>
        <button className="capture-tile photo" type="button" onClick={() => navigate('/log', { state: { mode: 'photo', returnTo: '/' } })} aria-label={t('today.photoScan')}>
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
