import { useLocation, useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import AppIcon, { type IconName } from './AppIcon'

// 方案 B 四格导航：今日 · 日历 · 教练 · 我的（无中间 FAB）
// 子路由归属所属分区高亮；/log 与 /workout 为记录流程，不高亮任何分区（保持一致）
const TABS: { key: 'today' | 'calendar' | 'coach' | 'me'; to: string; icon: IconName; match: (p: string) => boolean }[] = [
  { key: 'today', to: '/', icon: 'home', match: (p) => p === '/' },
  { key: 'calendar', to: '/calendar', icon: 'calendar', match: (p) => p === '/calendar' || p.startsWith('/day') || p === '/history' },
  { key: 'coach', to: '/coach', icon: 'sparkles', match: (p) => p === '/coach' || p === '/knowledge' },
  { key: 'me', to: '/settings', icon: 'user', match: (p) => p === '/settings' || p.startsWith('/settings/') || p === '/body' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { t } = useT()
  return (
    <nav className="bottom-nav" aria-label={t('nav.primary')}>
      {TABS.map((tab) => {
        const active = tab.match(pathname)
        return (
          <button
            key={tab.key}
            type="button"
            className={'nav-item' + (active ? ' active' : '')}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(tab.to)}
          >
            <span className="nav-icon"><AppIcon name={tab.icon} size={20} /></span>
            {t(`nav.${tab.key}` as 'nav.today')}
          </button>
        )
      })}
    </nav>
  )
}
