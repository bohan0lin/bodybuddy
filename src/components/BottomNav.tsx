import { NavLink } from 'react-router-dom'
import { useT } from '../lib/i18n'
import AppIcon, { type IconName } from './AppIcon'

// 方案 B 四格导航：今日 · 日历 · 教练 · 我的（无中间 FAB）
const TABS: { to: string; end?: boolean; icon: IconName; key: 'today' | 'calendar' | 'coach' | 'me' }[] = [
  { to: '/', end: true, icon: 'home', key: 'today' },
  { to: '/calendar', icon: 'calendar', key: 'calendar' },
  { to: '/coach', icon: 'sparkles', key: 'coach' },
  { to: '/settings', icon: 'user', key: 'me' },
]

export default function BottomNav() {
  const { t } = useT()
  const cls = ({ isActive }: { isActive: boolean }) => 'nav-item' + (isActive ? ' active' : '')
  return (
    <nav className="bottom-nav" aria-label={t('nav.primary')}>
      {TABS.map((tab) => (
        <NavLink key={tab.key} to={tab.to} end={tab.end} className={cls}>
          <span className="nav-icon"><AppIcon name={tab.icon} size={20} /></span>
          {t(`nav.${tab.key}` as 'nav.today')}
        </NavLink>
      ))}
    </nav>
  )
}
