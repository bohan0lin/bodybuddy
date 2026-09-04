import { useT } from '../lib/i18n'
import AppIcon from './AppIcon'

// Me 顶部：头像/名字/连续记录 + 右上偏好设置入口
export default function ProfileHeader({ name, streak, onProfile, onSettings }: { name: string; streak: number; onProfile: () => void; onSettings: () => void }) {
  const { t } = useT()
  const initial = name.trim().charAt(0).toUpperCase() || 'B'
  return (
    <header className="profile-header">
      <button className="avatar" type="button" onClick={onProfile} aria-label={t('me.profile')}>{initial}</button>
      <button className="profile-id" type="button" onClick={onProfile}>
        <div className="profile-name">{name}</div>
        <div className="streak">{t('me.streakText', { n: streak })}</div>
      </button>
      <button className="icon-btn" type="button" onClick={onSettings} aria-label={t('me.preferences')}>
        <AppIcon name="settings" size={19} />
      </button>
    </header>
  )
}
