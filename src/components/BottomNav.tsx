import { NavLink, useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'

// 对称底部导航：今日 · ＋记一餐 · 设置
export default function BottomNav() {
  const navigate = useNavigate()
  const { t } = useT()
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">◇</span>
        {t('nav.today')}
      </NavLink>

      <button className="nav-fab" onClick={() => navigate('/log')} aria-label={t('nav.logMeal')}>
        ＋
      </button>

      <NavLink to="/settings" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">○</span>
        {t('nav.settings')}
      </NavLink>
    </nav>
  )
}
