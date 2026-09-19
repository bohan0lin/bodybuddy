import { useState } from 'react'

// Only mounted in staging. Capture layout numbers, never input or account data.
export default function StagingDiagnostics() {
  const [report, setReport] = useState('')
  function capture() {
    const viewport = window.visualViewport
    const rect = (selector: string) => {
      const box = document.querySelector(selector)?.getBoundingClientRect()
      return box ? { top: box.top, bottom: box.bottom, height: box.height } : null
    }
    setReport(JSON.stringify({
      build: import.meta.env.VITE_BUILD_ID,
      userAgent: navigator.userAgent,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      window: { height: window.innerHeight, width: window.innerWidth, scrollY: window.scrollY },
      document: { height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight, scrollTop: document.documentElement.scrollTop },
      body: { scrollTop: document.body.scrollTop, height: document.body.clientHeight },
      viewport: viewport ? { height: viewport.height, offsetTop: viewport.offsetTop, pageTop: viewport.pageTop, scale: viewport.scale } : null,
      focusedTag: document.activeElement?.tagName,
      shell: rect('.app-shell-authed'),
      navigation: rect('.bottom-nav'),
    }, null, 2))
  }
  return <>
    <button type="button" onClick={capture} style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top) + 4px)', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
      padding: '2px 10px', border: 0, borderRadius: 999, background: '#b8860b', color: '#0a0a0b', fontSize: 10, fontWeight: 700 }}>
      STAGING · {import.meta.env.VITE_BUILD_ID} · Layout
    </button>
    {report && <section role="dialog" aria-label="Layout diagnostics" style={{ position: 'fixed', inset: '15% 12px', zIndex: 1001, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', padding: 16, overflow: 'auto' }}>
      <button type="button" onClick={() => setReport('')}>Close</button>
      <p>Share these layout measurements if the keyboard gap persists. No messages or account details are included.</p>
      <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' }}>{report}</pre>
    </section>}
  </>
}
