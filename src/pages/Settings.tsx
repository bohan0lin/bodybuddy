import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { useAuth } from '../data/auth'
import { useT } from '../lib/i18n'
import { usePrefs } from '../lib/prefs'

const ICONS: Record<string, ReactNode> = {
  body: <path d="M3 12h4l2-5 3 9 2-4h5" />,
  history: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15.5" rx="2.5" />
      <line x1="3.5" y1="9" x2="20.5" y2="9" />
      <line x1="8" y1="2.7" x2="8" y2="6.3" />
      <line x1="16" y1="2.7" x2="16" y2="6.3" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.4" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 2.4 14.6 0 17M12 3.5c-2.4 2.4-2.4 14.6 0 17" />
    </>
  ),
  theme: <path d="M20 14.5A7.5 7.5 0 1 1 9.5 4.3 6 6 0 0 0 20 14.5z" />,
  energy: <path d="M13 3c.5 3-2 4.5-2 7a2 2 0 0 0 4 0c0-.6-.2-1.2-.4-1.6C16 10 17 12 17 14a5 5 0 0 1-10 0c0-4 4-6 6-11z" />,
  logout: (
    <>
      <path d="M14 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" />
      <path d="M18 12H9" />
      <path d="M15 9l3 3-3 3" />
    </>
  ),
}

function Icon({ name }: { name: string }) {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <p style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '24px 4px 9px' }}>{title}</p>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
    </>
  )
}

function Row({ icon, label, value, danger, last, onClick }: { icon: string; label: string; value?: string; danger?: boolean; last?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '14px',
        background: 'transparent',
        borderBottom: last ? 'none' : '1px solid var(--line)',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: danger ? 'var(--protein)' : 'var(--accent)', flexShrink: 0 }}>
        <Icon name={icon} />
      </span>
      <span style={{ flex: 1, fontSize: 15, color: danger ? 'var(--protein)' : 'var(--text)' }}>{label}</span>
      {value && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{value}</span>}
      {!danger && <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>›</span>}
    </button>
  )
}

export default function Settings() {
  const { profile, latestWeight } = useStore()
  const { session, signOut } = useAuth()
  const { t, lang } = useT()
  const { theme, energyUnit } = usePrefs()
  const navigate = useNavigate()

  const name = profile.displayName?.trim() || (lang === 'zh' ? '你' : 'You')
  const initial = name.charAt(0).toUpperCase()

  const weightVal = latestWeight
    ? `${latestWeight.weight} kg${latestWeight.bodyFat != null ? ` · ${latestWeight.bodyFat}%` : ''}`
    : t('me.notSet')
  const goalVal = profile.targetCalories > 0 ? `${profile.targetCalories} ${t('energy.kcal')}` : t('me.notSet')
  const langVal = lang === 'zh' ? '中文' : 'English'
  const themeVal = t(`theme.${theme}` as 'theme.system')
  const energyVal = energyUnit === 'kJ' ? t('energy.kJ') : t('energy.kcal')

  return (
    <div className="page">
      {/* 个人卡：点击编辑资料 */}
      <button
        onClick={() => navigate('/settings/profile')}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 15, background: 'transparent', textAlign: 'left', cursor: 'pointer', marginBottom: 4 }}
      >
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--accent)', flexShrink: 0 }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--text)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session?.user.email}</div>
        </div>
        <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>›</span>
      </button>

      <Section title={t('me.section.data')}>
        <Row icon="body" label={t('me.bodyData')} value={weightVal} onClick={() => navigate('/body', { state: { back: '/settings' } })} />
        <Row icon="history" label={t('me.history')} last onClick={() => navigate('/calendar', { state: { back: '/settings' } })} />
      </Section>

      <Section title={t('me.section.goals')}>
        <Row icon="target" label={t('settings.dailyTargets')} value={goalVal} last onClick={() => navigate('/settings/targets')} />
      </Section>

      <Section title={t('me.section.prefs')}>
        <Row icon="language" label={t('settings.language')} value={langVal} onClick={() => navigate('/settings/language')} />
        <Row icon="theme" label={t('settings.theme')} value={themeVal} onClick={() => navigate('/settings/theme')} />
        <Row icon="energy" label={t('settings.energyUnit')} value={energyVal} last onClick={() => navigate('/settings/energy')} />
      </Section>

      <Section title={t('me.section.account')}>
        <Row icon="logout" label={t('settings.signOut')} danger last onClick={() => signOut()} />
      </Section>

      <p className="muted" style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 26 }}>
        {t('settings.footer')}
      </p>
    </div>
  )
}
