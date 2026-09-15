import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts', 'evals/**/*.test.ts', 'scripts/environments.test.mjs', 'scripts/staging/**/*.test.mjs'] },
})
