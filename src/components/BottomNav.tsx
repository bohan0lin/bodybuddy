import { NavLink, useNavigate } from 'react-router-dom'

// 对称底部导航：今日 · ＋记一餐 · 设置
export default function BottomNav() {
  const navigate = useNavigate()
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">◇</span>
        今日
      </NavLink>

      <button className="nav-fab" onClick={() => navigate('/log')} aria-label="记一餐">
        ＋
      </button>

      <NavLink to="/settings" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
        <span className="nav-icon">○</span>
        设置
      </NavLink>
    </nav>
  )
}
