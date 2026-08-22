import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 开发环境模拟 /api/*（线上由 Vercel Serverless Function 提供，逻辑同一份 api/lib/claude.ts）
function apiDevPlugin(): Plugin {
  return {
    name: 'bodybuddy-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/') || req.method !== 'POST') return next()

        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString() || '{}')

          // 通过 Vite 加载 TS 模块（自动转译、依赖走 node_modules）
          const mod = await server.ssrLoadModule('/api/lib/ai.ts')

          let result: unknown
          if (url.startsWith('/api/suggest')) result = await mod.suggestMeal(body)
          else if (url.startsWith('/api/recognize')) result = await mod.recognizeFood(body.image, body.mediaType)
          else return next()

          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (e) {
          console.error('[api-dev]', e)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'AI 服务出错' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载所有环境变量（含无 VITE_ 前缀的私密变量），供开发中间件里的 AI SDK 使用
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY

  return {
    plugins: [
      react(),
      apiDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'BodyBuddy',
          short_name: 'BodyBuddy',
          description: '记录体重、体脂与每日饮食，AI 帮你安排剩下该吃什么',
          theme_color: '#0a0a0b',
          background_color: '#0a0a0b',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          lang: 'zh-CN',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})
