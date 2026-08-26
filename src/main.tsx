import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './data/auth'
import { I18nProvider } from './lib/i18n'
import { PrefsProvider } from './lib/prefs'

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
