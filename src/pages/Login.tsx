import { useState } from 'react'
import { useAuth } from '../data/auth'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'in') {
      const { error } = await signIn(email.trim(), password)
      if (error) setMsg(translate(error))
    } else {
      const { error, needConfirm } = await signUp(email.trim(), password)
      if (error) setMsg(translate(error))
      else if (needConfirm) setMsg('注册成功 · 请到邮箱点击确认链接后再登录')
    }
    setBusy(false)
  }

  return (
    <div className="app-shell">
      <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <img src="/icon.svg" alt="BodyBuddy" width={64} height={64} style={{ borderRadius: 18, marginBottom: 18 }} />
          <h1 style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.01em', margin: '0 0 6px' }}>
            BodyBuddy
          </h1>
          <p className="muted" style={{ fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>
            {mode === 'in' ? '欢迎回来' : '创建账号'}
          </p>
        </div>

        <form onSubmit={submit} className="card">
          <div className="field">
            <label>邮箱</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 22 }}>
            <label>密码</label>
            <input
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              placeholder="至少 6 位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {msg && (
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 16px', lineHeight: 1.6 }}>{msg}</p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? '请稍候…' : mode === 'in' ? '登录' : '注册'}
          </button>
        </form>

        <button
          className="btn-ghost"
          style={{ marginTop: 8, fontSize: 14 }}
          onClick={() => {
            setMode((m) => (m === 'in' ? 'up' : 'in'))
            setMsg(null)
          }}
        >
          {mode === 'in' ? '还没有账号？去注册' : '已有账号？去登录'}
        </button>
      </div>
    </div>
  )
}

// 常见错误的中文提示
function translate(err: string): string {
  if (/Invalid login credentials/i.test(err)) return '邮箱或密码不正确'
  if (/already registered/i.test(err)) return '该邮箱已注册，请直接登录'
  if (/at least 6/i.test(err)) return '密码至少需要 6 位'
  if (/valid email/i.test(err)) return '请输入有效的邮箱地址'
  return err
}
