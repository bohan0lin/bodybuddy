import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { isConfigured } from './lib/supabase'
import { useAuth } from './data/auth'
import { StoreProvider, useStore } from './data/store'
import { useT } from './lib/i18n'
import BottomNav from './components/BottomNav'
import Today from './pages/Today'
import Login from './pages/Login'

// 首页与外壳留在初始包；其余路由按需加载，减小首屏 JS
const Body = lazy(() => import('./pages/Body'))
const LogMeal = lazy(() => import('./pages/LogMeal'))
const Settings = lazy(() => import('./pages/Settings'))
const History = lazy(() => import('./pages/History'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Day = lazy(() => import('./pages/Day'))
const Coach = lazy(() => import('./pages/Coach'))
const Knowledge = lazy(() => import('./pages/Knowledge'))
const LogWorkout = lazy(() => import('./pages/LogWorkout'))
const SettingsTargets = lazy(() => import('./pages/SettingsTargets'))
const SettingsProfile = lazy(() => import('./pages/SettingsProfile'))

function Splash({ text }: { text: string }) {
  return (
    <div className="app-shell">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="muted" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>{text}</span>
      </div>
    </div>
  )
}

// 路由切换时的轻量品牌占位（懒加载 chunk 到达前）
function RouteFallback() {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="muted" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>BodyBuddy</span>
    </div>
  )
}

function ConfigNeeded() {
  return (
    <div className="app-shell">
      <div className="page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p className="eyebrow">配置</p>
        <div className="card">
          <p style={{ marginTop: 0 }}>还没有连接 Supabase。</p>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
            请在项目根目录创建 <code>.env.local</code>，填入你的 Supabase 地址与 anon key，然后重启
            <code> npm run dev</code>：
          </p>
          <pre style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 10, fontSize: 12, overflow: 'auto' }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
          </pre>
        </div>
      </div>
    </div>
  )
}

// 数据加载失败：不渲染受保护路由，给出重试（绝不在错误时展示可编辑的全 0 表单）
function HydrationError({ onRetry }: { onRetry: () => void }) {
  const { t } = useT()
  return (
    <div className="app-shell">
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 280 }}>{t('common.loadFailed')}</p>
        <button className="btn btn-primary" onClick={onRetry}>{t('common.retry')}</button>
      </div>
    </div>
  )
}

// 数据水合完成前不渲染受保护路由，避免表单从 DEFAULT_PROFILE(全 0) 初始化后覆盖真实数据
function AuthedApp() {
  const { loading, hydrationError, reload } = useStore()
  if (loading) return <Splash text="BodyBuddy" />
  if (hydrationError) return <HydrationError onRetry={reload} />
  return (
    <div className="app-shell">
      <div className="app-glow" aria-hidden="true" />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/body" element={<Body />} />
          <Route path="/history" element={<History />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/day/:date" element={<Day />} />
          <Route path="/log" element={<LogMeal />} />
          <Route path="/workout" element={<LogWorkout />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/targets" element={<SettingsTargets />} />
          <Route path="/settings/profile" element={<SettingsProfile />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/knowledge" element={<Knowledge />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <ConfigNeeded />
  if (loading) return <Splash text="BodyBuddy" />
  if (!session) return <Login />

  return (
    <StoreProvider userId={session.user.id}>
      <AuthedApp />
    </StoreProvider>
  )
}
