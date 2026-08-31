import { existsSync, readFileSync } from 'node:fs'

// 本地跑时从 .env.local 读密钥；CI 里这些由 GitHub Secrets 注入到环境，文件不存在也没关系
export function loadEnvLocal(): void {
  const url = new URL('../.env.local', import.meta.url)
  try {
    if (!existsSync(url)) return
    const txt = readFileSync(url, 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
    }
  } catch {
    /* 忽略 */
  }
}
