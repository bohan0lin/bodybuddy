import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'
import WorkoutDot from './WorkoutDot'

// 方案 B 五格导航：今日 · 教练 · ＋（记一餐/记运动） · 知识 · 我的
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
const MealIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3v8a2 2 0 0 0 4 0V3M8 3v18" />
    <path d="M16 3c-1.5 1-2.5 3-2.5 5.5S15 13 16 13v8" />
  </svg>
)

export default function BottomNav() {
  const navigate = useNavigate()
  const { t } = useT()
  const [sheet, setSheet] = useState(false)
  const cls = ({ isActive }: { isActive: boolean }) => 'nav-item' + (isActive ? ' active' : '')

  const go = (to: string) => {
    setSheet(false)
    navigate(to)
  }

  return (
    <>
      {sheet && (
        <div
          onClick={() => setSheet(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTop: '1px solid var(--line)', padding: '10px 16px calc(20px + env(safe-area-inset-bottom))' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line-strong)', margin: '4px auto 16px' }} />
            <button className="btn btn-block" style={{ marginBottom: 10, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={() => go('/log')}>
              <MealIcon />
              {t('nav.logMeal')}
            </button>
            <button className="btn btn-block" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }} onClick={() => go('/workout')}>
              <WorkoutDot size={20} color="currentColor" />
              {t('nav.logWorkout')}
            </button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <NavLink to="/" end className={cls}>
          <span className="nav-icon"><HomeIcon /></span>
          {t('nav.today')}
        </NavLink>

        <NavLink to="/coach" className={cls}>
          <span className="nav-icon" style={{ fontSize: 19 }}>✦</span>
          {t('nav.coach')}
        </NavLink>

        <button className="nav-fab" onClick={() => setSheet(true)} aria-label={t('nav.logMeal')}>
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
    </>
  )
}
