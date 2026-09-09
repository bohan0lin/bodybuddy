import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
if (process.env.E2E_LOCAL_ONLY !== '1' || process.env.E2E_SUPABASE_URL !== 'http://127.0.0.1:54321') throw new Error('Use npm run test:e2e with the disposable local stack')
export default defineConfig({
  testDir: '.', testMatch: 'proposals.spec.ts', fullyParallel: false, workers: 1, retries: 0,
  timeout: 30000, reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { baseURL: 'http://127.0.0.1:5182', trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1100, height: 900 } } }, { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
  webServer: { cwd: root, command: 'node node_modules/vite/bin/vite.js --config tests/e2e/vite.config.ts', url: 'http://127.0.0.1:5182', reuseExistingServer: false, timeout: 60000 },
})
