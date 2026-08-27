import { Route, Routes } from 'react-router-dom'
import { isConfigured } from './lib/supabase'
import { useAuth } from './data/auth'
import { StoreProvider } from './data/store'
import BottomNav from './components/BottomNav'
import Assistant from './components/Assistant'
import Today from './pages/Today'
import Body from './pages/Body'
import LogMeal from './pages/LogMeal'
import Settings from './pages/Settings'
import Login from './pages/Login'
import AISuggest from './pages/AISuggest'
import History from './pages/History'
import Day from './pages/Day'

function Splash({ text }: { text: string }) {
  return (
    <div className="app-shell">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="muted" style={{ letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: 12 }}>{text}</span>
      </div>
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

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <ConfigNeeded />
  if (loading) return <Splash text="BodyBuddy" />
  if (!session) return <Login />

  return (
    <StoreProvider userId={session.user.id}>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/body" element={<Body />} />
          <Route path="/history" element={<History />} />
          <Route path="/day/:date" element={<Day />} />
          <Route path="/ai" element={<AISuggest />} />
          <Route path="/log" element={<LogMeal />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        <Assistant />
        <BottomNav />
      </div>
    </StoreProvider>
  )
}
