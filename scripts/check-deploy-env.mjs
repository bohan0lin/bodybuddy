import { deployEnvironmentProblems } from './environments.mjs'

// Runs before every build. It only enforces rules when Vercel reports a preview or production deployment.
const problems = deployEnvironmentProblems(process.env)
if (problems.length) {
  console.error(`Deployment environment check failed for VERCEL_ENV=${process.env.VERCEL_ENV}:\n${problems.map((problem) => `- ${problem}`).join('\n')}`)
  console.error('See docs/STAGING.md.')
  process.exit(1)
}
if (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'production') {
  console.log(`Deployment environment check passed for VERCEL_ENV=${process.env.VERCEL_ENV}.`)
}
