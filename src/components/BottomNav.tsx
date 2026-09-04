import { useLocation, useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { NAV_TABS, activeTabKey } from '../lib/nav'
import AppIcon from './AppIcon'

// 方案 B 四格导航：今日 · 日历 · 教练 · 我的（无中间 FAB）
export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { t } = useT()
  const active = activeTabKey(pathname)
  return (
    <nav className="bottom-nav" aria-label={t('nav.primary')}>
      {NAV_TABS.map((tab) => {
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            className={'nav-item' + (isActive ? ' active' : '')}
            aria-current={isActive ? 'page' : undefined}
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
