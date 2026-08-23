import { useState } from 'react'
import { useAuth } from '../data/auth'
import { useT } from '../lib/i18n'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const { t } = useT()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function translate(err: string): string {
    if (/Invalid login credentials/i.test(err)) return t('login.errInvalid')
    if (/already registered/i.test(err)) return t('login.errRegistered')
    if (/at least 6/i.test(err)) return t('login.errPwLen')
    if (/valid email/i.test(err)) return t('login.errEmail')
    return err
  }

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
      else if (needConfirm) setMsg(t('login.needConfirm'))
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
            {mode === 'in' ? t('login.welcomeBack') : t('login.createAccount')}
          </p>
        </div>

        <form onSubmit={submit} className="card">
          <div className="field">
            <label>{t('login.email')}</label>
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
            <label>{t('login.password')}</label>
            <input
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              placeholder={t('login.passwordPh')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {msg && <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 16px', lineHeight: 1.6 }}>{msg}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t('login.wait') : mode === 'in' ? t('login.signIn') : t('login.signUp')}
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
          {mode === 'in' ? t('login.toSignUp') : t('login.toSignIn')}
        </button>
      </div>
    </div>
  )
}
