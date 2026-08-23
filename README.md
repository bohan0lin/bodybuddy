# BodyBuddy

> A minimal, high-end nutrition & body tracker — log your weight, body fat, and meals, and let AI plan what to eat next.
> 极简高级的健身饮食追踪应用 —— 记录体重、体脂与每一餐，让 AI 帮你安排接下来该吃什么。

**English** · [中文](#中文)

🔗 **Live demo:** _https://your-app.vercel.app_ &nbsp;·&nbsp; built with React + Supabase + Vercel AI SDK

---

## English

BodyBuddy is a mobile-first **PWA** for tracking daily nutrition and body metrics, with an AI coach that suggests what to eat based on what you've already had today.

### ✨ Features

- **Daily dashboard** — remaining calories & macro rings, latest weight with an in-card 7-point trend, all on one screen.
- **Body tracking** — log weight & body fat, see the trend chart, drill into full history.
- **Meal logging with a reusable library** — save foods and meal templates once, reuse them instantly.
- **Portion scaling** — save `Chicken breast · 100g = 31g protein`, then log `150g` next time and the macros auto-scale (×1.5). Works with any unit (g / serving / ml / piece).
- **AI suggestions** — "what can I still eat?" based on today's intake, in two modes: *from your saved library* or *general*.
- **AI photo recognition** — snap a photo of a meal, get estimated foods & macros auto-filled into the form.
- **Accounts & cloud sync** — email/password auth; every user sees only their own data (Postgres Row-Level Security).
- **Provider-agnostic AI** — swap between Gemini / OpenAI / Claude by changing a single line.

### 🛠 Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19, TypeScript, Vite, React Router |
| UI / charts | Custom design system (CSS variables), Recharts, `vite-plugin-pwa` |
| Data & auth | Supabase (Postgres, Auth, Row-Level Security) |
| AI | Vercel AI SDK (`ai`) + `@ai-sdk/google` (default Gemini), swappable to OpenAI / Anthropic |
| Hosting | Vercel (static frontend + serverless functions) |

### 🧱 Architecture highlights

- **Secrets stay server-side.** AI calls go through serverless functions in `api/` (and a matching Vite dev middleware) that share one handler in `api/lib/ai.ts` — the API key is never shipped to the browser.
- **One-line model switching.** `api/lib/ai.ts` exposes a single `MODEL` constant; the rest of the code is provider-agnostic thanks to the Vercel AI SDK.
- **Structured output** for photo recognition (Zod schema) guarantees valid, typed results.
- **Row-Level Security** enforces per-user data isolation at the database, not just the client.

### 🚀 Getting started (local)

```bash
# 1. Install
npm install

# 2. Set up the database
#    Create a free Supabase project, open SQL Editor,
#    paste and run supabase/schema.sql

# 3. Configure environment
cp .env.example .env.local
#    Fill in:
#    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (Supabase → Project Settings → API)
#    GOOGLE_GENERATIVE_AI_API_KEY               (https://aistudio.google.com/apikey)

# 4. Run
npm run dev            # http://localhost:5173
```

### ☁️ Deployment

Deploys to **Vercel** out of the box. Import the repo, then add the three environment variables above in *Project → Settings → Environment Variables*. Vercel auto-detects Vite for the frontend and turns `api/*.ts` into serverless functions. Every push redeploys automatically.

### 📁 Project structure

```
api/            Serverless functions (AI proxy) + shared handler
src/
  pages/        Today, Body, History, LogMeal, AI, Settings, Login
  components/    ProgressRing, MacroBar, BottomNav
  data/         Supabase store + auth context
  lib/          nutrition math, API client, image resize, supabase client
supabase/       schema.sql (tables + RLS + triggers)
```

---

## 中文

BodyBuddy 是一个移动优先的 **PWA** 健身饮食追踪应用，带一个会根据你今天已经吃的来建议"接下来吃什么"的 AI 教练。

### ✨ 功能

- **今日概览** —— 剩余热量与三大宏量素进度、最新体重及卡片内的 7 点趋势曲线，一屏呈现。
- **身体数据** —— 记录体重与体脂，查看趋势图，点进完整历史记录。
- **带常用库的饮食记录** —— 食物与套餐保存一次，之后一键复用。
- **分量换算** —— 存下「鸡胸肉 · 100g = 31g 蛋白」，下次记 `150g` 时营养自动 ×1.5。支持任意单位（g / 份 / ml / 个）。
- **AI 建议** —— 根据今天已摄入，给出"还能吃什么"，两种模式：*从你的常用库挑* 或 *通用建议*。
- **拍照识别** —— 拍一张食物照，AI 估算食物与营养并自动填入表单。
- **账号与云端同步** —— 邮箱密码登录；每个用户只能看到自己的数据（数据库级行级安全 RLS）。
- **AI 供应商可切换** —— 改一行即可在 Gemini / OpenAI / Claude 之间切换。

### 🛠 技术栈

| 层 | 选型 |
|-----|------|
| 前端 | React 19、TypeScript、Vite、React Router |
| UI / 图表 | 自建设计系统（CSS 变量）、Recharts、`vite-plugin-pwa` |
| 数据与鉴权 | Supabase（Postgres、Auth、行级安全 RLS） |
| AI | Vercel AI SDK（`ai`）+ `@ai-sdk/google`（默认 Gemini），可切换 OpenAI / Anthropic |
| 托管 | Vercel（静态前端 + Serverless 函数） |

### 🧱 架构亮点

- **密钥只在服务端。** AI 调用经由 `api/` 下的 Serverless 函数（及对应的 Vite 开发中间件），二者共用 `api/lib/ai.ts` 中的同一份逻辑 —— API key 绝不下发到浏览器。
- **一行切换模型。** `api/lib/ai.ts` 顶部一个 `MODEL` 常量搞定切换，其余代码借助 Vercel AI SDK 与供应商无关。
- **结构化输出** 让拍照识别（Zod schema）稳定返回类型正确的结果。
- **行级安全** 在数据库层强制每用户数据隔离，而不仅仅依赖前端。

### 🚀 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 建数据库
#    在 Supabase 免费项目的 SQL Editor 里，
#    粘贴并运行 supabase/schema.sql

# 3. 配置环境变量
cp .env.example .env.local
#    填入：
#    VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY  （Supabase → Project Settings → API）
#    GOOGLE_GENERATIVE_AI_API_KEY               （https://aistudio.google.com/apikey）

# 4. 启动
npm run dev            # http://localhost:5173
```

### ☁️ 部署

开箱即可部署到 **Vercel**。导入仓库后，在 *Project → Settings → Environment Variables* 加上上面三个环境变量即可。Vercel 会自动识别 Vite 构建前端，并把 `api/*.ts` 变成 Serverless 函数。之后每次 push 自动重新部署。

### 📁 目录结构

```
api/            Serverless 函数（AI 代理）+ 共用逻辑
src/
  pages/        今日 / 身体 / 历史 / 记一餐 / AI / 设置 / 登录
  components/    进度环、宏量素条、底部导航
  data/         Supabase 数据层 + 鉴权 context
  lib/          营养计算、API 客户端、图片压缩、supabase 客户端
supabase/       schema.sql（建表 + RLS + 触发器）
```

---

<sub>Built by [@bohan0lin](https://github.com/bohan0lin) · Frontend, database, and AI integration by hand with Claude Code.</sub>
