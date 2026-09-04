import { useNavigate } from 'react-router-dom'
import { useAuth } from '../data/auth'
import { useT, type Lang } from '../lib/i18n'
import { usePrefs, type Theme } from '../lib/prefs'
import AppIcon from './AppIcon'

// 偏好设置弹层：语言 / 外观 直选；下方账户、知识库、退出
export default function PreferencesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang } = useT()
  const { theme, setTheme } = usePrefs()
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  if (!open) return null

  const langs: { key: Lang; label: string }[] = [
    { key: 'en', label: 'English' },
    { key: 'zh', label: '中文' },
  ]
  const themes: { key: Theme; label: string }[] = [
    { key: 'system', label: t('theme.system') },
    { key: 'light', label: t('theme.light') },
    { key: 'dark', label: t('theme.dark') },
  ]

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={t('me.preferences')} onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-title">
          <strong>{t('me.preferences')}</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('me.close')}><AppIcon name="x" size={18} /></button>
        </div>

        <div className="sheet-group">
          <span>{t('settings.language')}</span>
          <div className="segmented two" role="group" aria-label={t('settings.language')}>
            {langs.map((l) => (
              <button key={l.key} type="button" className={lang === l.key ? 'selected' : ''} aria-pressed={lang === l.key} onClick={() => setLang(l.key)}>{l.label}</button>
            ))}
          </div>
        </div>

        <div className="sheet-group">
          <span>{t('me.appearance')}</span>
          <div className="segmented" role="group" aria-label={t('me.appearance')}>
            {themes.map((th) => (
              <button key={th.key} type="button" className={theme === th.key ? 'selected' : ''} aria-pressed={theme === th.key} onClick={() => setTheme(th.key)}>{th.label}</button>
            ))}
          </div>
        </div>

        <hr className="divider" style={{ margin: '18px 0 2px' }} />

        <button className="sheet-row" type="button" onClick={() => navigate('/knowledge')}>
          <span>{t('knowledge.title')}</span>
          <AppIcon name="chevron-right" size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="sheet-row">
          <span>{t('settings.account')}</span>
          <span className="val">{session?.user.email}</span>
        </div>
        <button className="sheet-row danger" type="button" onClick={() => signOut()}>{t('settings.signOut')}</button>
      </div>
    </div>
  )
}
