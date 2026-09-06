import { apiMiddleware } from './api/lib/dev.js'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Development and Vercel use the same authenticated endpoint dispatcher.
function apiDevPlugin(): Plugin {
  return {
    name: 'bodybuddy-api-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(apiMiddleware)
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
  // 供开发中间件里的 RAG 检索（服务端 Supabase 客户端）使用
  if (env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
  if (env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY
  if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL
  if (env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY

  return {
    plugins: [
      react(),
      apiDevPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false, // 手动在 main.tsx 注册，加入定时/回前台检查更新
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
