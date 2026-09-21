import { loadProviderKeys } from './provider-env.mjs'

// Explicit opt-in wrapper. The runner still isolates any inherited database settings.
loadProviderKeys('.env.local')
await import('./run.ts')
