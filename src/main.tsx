import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './data/auth'
import { I18nProvider } from './lib/i18n'
import { PrefsProvider } from './lib/prefs'

// 外壳高度用真实可视高度：window.innerHeight 在 iOS 键盘弹出时不变（避免收键盘后底部留白），
// 又能随工具栏/旋转变化铺满短页面。比 CSS 的 svh/dvh 二选一更稳。
function setAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}
setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)

// 注册 Service Worker：有新版本自动应用并刷新；定时 + 回到前台时检查更新
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (!r) return
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) r.update()
    }
    setInterval(check, 60 * 60 * 1000) // 每小时
    document.addEventListener('visibilitychange', check) // 每次回到前台
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <PrefsProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </PrefsProvider>
    </I18nProvider>
  </StrictMode>,
)
