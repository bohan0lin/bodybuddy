import { NavLink, useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'

// 方案 B 五格导航：今日 · 教练 · ＋记一餐 · 知识 · 我的
const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const HomeIcon = () => (
  <svg {...svgProps}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.3V20h13V9.3" />
  </svg>
)
const BookIcon = () => (
  <svg {...svgProps}>
    <path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 0-2 2z" />
    <path d="M17.5 20a2 2 0 0 0-2-2H5" />
    <line x1="8.5" y1="8.5" x2="14" y2="8.5" />
  </svg>
)
const UserIcon = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  </svg>
)

export default function BottomNav() {
  const navigate = useNavigate()
  const { t } = useT()
  const cls = ({ isActive }: { isActive: boolean }) => 'nav-item' + (isActive ? ' active' : '')

  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={cls}>
        <span className="nav-icon"><HomeIcon /></span>
        {t('nav.today')}
      </NavLink>

      <NavLink to="/coach" className={cls}>
        <span className="nav-icon" style={{ fontSize: 19 }}>✦</span>
        {t('nav.coach')}
      </NavLink>

      <button className="nav-fab" onClick={() => navigate('/log')} aria-label={t('nav.logMeal')}>
        ＋
      </button>

      <NavLink to="/knowledge" className={cls}>
        <span className="nav-icon"><BookIcon /></span>
        {t('nav.knowledge')}
      </NavLink>

      <NavLink to="/settings" className={cls}>
        <span className="nav-icon"><UserIcon /></span>
        {t('nav.me')}
      </NavLink>
    </nav>
  )
}
