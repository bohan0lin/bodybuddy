// Guards shared by deployment builds and seed scripts so non-production work cannot reach production data.
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'

// Returns the Supabase project ref, 'local' for the disposable stack, or null for anything unrecognised.
export function projectRef(url) {
  if (!url) return null
  const trimmed = String(url).trim().replace(/\/+$/, '')
  if (trimmed === LOCAL_SUPABASE_URL) return 'local'
  let parsed
  try { parsed = new URL(trimmed) } catch { return null }
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' && parsed.pathname !== '') return null
  const match = parsed.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)
  return match ? match[1] : null
}

export function assertSeedTarget({ url, expectedRef, productionRef, confirmedRef }) {
  const ref = projectRef(url)
  if (!ref) throw new Error('STAGING_SUPABASE_URL must be https://<project-ref>.supabase.co or the local stack')
  if (ref !== expectedRef) throw new Error('STAGING_SUPABASE_PROJECT_REF does not match STAGING_SUPABASE_URL')
  if (ref !== 'local') {
    if (!productionRef) throw new Error('PRODUCTION_SUPABASE_PROJECT_REF is required so the production project can be refused')
    if (ref === productionRef) throw new Error('Refusing to seed the production project')
  }
  if (confirmedRef !== ref) throw new Error(`Re-run with --confirm ${ref} to seed this project`)
  return ref
}

// Vercel exposes VERCEL_ENV during builds; local and CI builds are not deployments and are not checked.
export function deployEnvironmentProblems(env) {
  const target = env.VERCEL_ENV
  if (target !== 'preview' && target !== 'production') return []
  const problems = []
  const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF
  const browserRef = projectRef(env.VITE_SUPABASE_URL)
  const serverRef = projectRef(env.SUPABASE_URL || env.VITE_SUPABASE_URL)
  if (!browserRef || browserRef === 'local') problems.push('VITE_SUPABASE_URL must be a hosted https://<project-ref>.supabase.co URL')
  if (!serverRef || serverRef === 'local') problems.push('SUPABASE_URL (or VITE_SUPABASE_URL) must be a hosted https://<project-ref>.supabase.co URL')
  if (browserRef && serverRef && browserRef !== serverRef) problems.push('Browser and server must use the same Supabase project')
  if (target === 'preview') {
    if (env.VITE_APP_ENV !== 'staging') problems.push('Preview builds must set VITE_APP_ENV=staging')
    if (!productionRef) problems.push('Preview builds must set PRODUCTION_SUPABASE_PROJECT_REF so the production project can be refused')
    else if (browserRef === productionRef || serverRef === productionRef) problems.push('Preview builds must not use the production Supabase project')
  } else {
    if (env.VITE_APP_ENV && env.VITE_APP_ENV !== 'production') problems.push('Production builds must not set VITE_APP_ENV to a non-production value')
    if (productionRef && (browserRef !== productionRef || serverRef !== productionRef)) problems.push('Production builds must use the PRODUCTION_SUPABASE_PROJECT_REF project')
  }
  return problems
}
