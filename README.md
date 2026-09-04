# BodyBuddy

> A minimal, high-end nutrition & training tracker — log meals, workouts, and body metrics, and chat with an AI coach that reasons over your real data and your own knowledge.
> 极简高级的健身饮食追踪应用 —— 记录饮食、运动与身体数据，和一个能结合你真实数据与个人知识作答的 AI 教练对话。

**English** · [中文](#中文)

🔗 **Live demo:** https://bodybuddy-ten.vercel.app &nbsp;·&nbsp; built with React + Supabase + Vercel AI SDK

---

## English

BodyBuddy is a mobile-first, bilingual **PWA** for tracking daily nutrition, workouts, and body metrics — with an AI coach that answers using your actual intake, training, and a personal knowledge base you build by voice.

### ✨ Features

- **Four-tab navigation** — Today · Calendar · Coach · Me.
- **Today** — a swipeable **Remaining Today / Today's Workout** summary card; one-tap **meal capture** (Voice, Photo, Manual); a seven-day **calorie "wrap" ring** strip (each full loop = 100% of target, darkening as you go over) with a ring-center workout marker; and today's meals. (No weight-trend preview here — weight lives on the Body page.)
- **Meal capture** — **Voice log** (speak your meal via the Web Speech API, review the transcript, confirm), **Photo scan** (one tap opens the camera, AI estimates nutrition), and **manual entry** — all confirm-before-write.
- **AI coach (chat)** — ask "how have I been eating?" or "plan my remaining meals"; it reasons over your real targets, today's intake, recent days, workouts, and your knowledge base. It can **log meals & workouts through tool calls**, always **proposing first and saving only after you confirm**. Quick example prompts get you started in one tap.
- **Meal logging** — a reusable food/meal **library with portion scaling** (save `Chicken breast · 100g = 31g protein`, log `150g` next time and macros auto-scale ×1.5), plus **photo recognition** and **RAG-grounded nutrition lookup**.
- **Workout logging** — pick an activity type and duration; calories burned are auto-estimated (MET × body-weight × time) and editable. Workout days show a dumbbell marker on the 7-day strip and calendar.
- **Personal knowledge base** — dictate a fitness tip in one line (keyboard mic); the AI tidies it into a clean, tagged entry. The coach feeds your **whole** library into its context, so advice reflects your own principles (e.g. carb cycling). Per-user and private.
- **Calendar & history** — month grid with per-day calorie rings and workout markers; drill into any day to edit meals/workouts.
- **Accounts & cloud sync** — email/password auth; every user sees only their own data (Postgres Row-Level Security).
- **Me** — profile with a derived tracking streak, a goal hero (real daily targets, optional goal type), body metrics (height / weight / BMI / body fat), monthly consistency, and a **preferences sheet** (language + theme live here).
- **Bilingual & theming** — Chinese/English, light/dark/system theme, kcal/kJ units.
- **Provider-agnostic AI** — swap Gemini / OpenAI / Claude by changing one line.
- **AI eval harness** — deterministic graders for RAG food lookup and assistant tool-calls; runs locally or on PRs (reminder-only CI).

### 🛠 Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 19, TypeScript, Vite, React Router |
| UI / charts | Custom design system (CSS variables), Recharts, `vite-plugin-pwa` |
| Data & auth | Supabase (Postgres, Auth, Row-Level Security, **pgvector**) |
| AI | Vercel AI SDK (`ai`) + `@ai-sdk/google` (default Gemini), swappable to OpenAI / Anthropic |
| Evals | `tsx` runner + GitHub Actions |
| Hosting | Vercel (static frontend + serverless functions) |

### 🧱 Architecture highlights

- **Secrets stay server-side.** AI calls go through serverless functions in `api/` (with a matching Vite dev middleware) — API keys never reach the browser.
- **Confirm-before-write AI.** The coach's tools only *propose* actions (log meal/workout, save favorite); the client executes them via the store after you confirm — no server-side DB writes, no JWT plumbing.
- **RAG grounding.** Food names/photos are grounded against a pgvector nutrition table (`match_foods`) so estimates snap to real per-100g values when a match is confident.
- **One-line model switching** via a single `MODEL` constant, thanks to the provider-agnostic Vercel AI SDK.
- **Row-Level Security** enforces per-user isolation at the database, not just the client.
- **Structured output** (Zod schemas) for photo recognition and knowledge tidying guarantees valid, typed results.

### 🚀 Getting started (local)

```bash
# 1. Install
npm install

# 2. Set up the database (Supabase → SQL Editor, run each file)
#    supabase/schema.sql       tables + RLS + triggers (profiles, meals, weights, saved items, workouts)
#    supabase/rag.sql          pgvector foods table + match_foods (food-nutrition RAG)
#    supabase/knowledge.sql    per-user knowledge table + RLS
#    (optional) node --env-file=.env.local scripts/seed-foods.mjs   seed the nutrition库

# 3. Configure environment
cp .env.example .env.local
#    VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY  (Supabase → Project Settings → API)
#    GOOGLE_GENERATIVE_AI_API_KEY               (https://aistudio.google.com/apikey)

# 4. Run
npm run dev            # http://localhost:5173

# 5. (optional) Run the AI evals
npm run eval           # or: npm run eval -- lookup | assistant
```

### ☁️ Deployment

Deploys to **Vercel** out of the box. Import the repo, add the three environment variables in *Project → Settings → Environment Variables*. Vercel auto-detects Vite for the frontend and turns `api/*.ts` into serverless functions; every push redeploys. For the eval CI, add the same three keys as GitHub Actions secrets (keep the check non-required so it only reminds).

### 📁 Project structure

```
api/            Serverless functions (assistant, recognize, lookup, knowledge) + shared lib/
src/
  pages/        Today, Coach, LogMeal, LogWorkout, Knowledge, Body, History,
                Calendar, Day, Settings (Me) + settings/{targets,profile}, Login
  components/   AppIcon, CalorieRing, DailySummaryCarousel, MealCapturePanel,
                SevenDayStrip, TodayMeals, ProfileHeader, GoalHero, BodyMetricGrid,
                PreferencesSheet, MacroBar, ProgressRing, BottomNav, SubHeader, EnergyToggle
  data/         Supabase store + auth context
  lib/          nutrition & workout math, API client, image resize + photo handoff, i18n, prefs, supabase
supabase/       schema.sql, rag.sql, knowledge.sql, migration-goal-type.sql
evals/          AI eval harness (datasets + runner)
scripts/        food-nutrition seed data + scripts
```

> Routes are code-split with `React.lazy`; only Today and the app shell are in the initial bundle.

---

## 中文

BodyBuddy 是一个移动优先、中英双语的 **PWA**，用来记录每日饮食、运动与身体数据，并配了一个能结合你**真实摄入/训练**和**你亲手建立的知识库**来作答的 AI 教练。

### ✨ 功能

- **四格导航** —— 今日 · 日历 · 教练 · 我的。
- **今日** —— 可左右切换的**「今日剩余 / 今日运动」**概览卡；一键**记录这一餐**（语音 / 拍照 / 手动）；近 7 天**卡路里套圈环**条（转满一圈=达标，超了继续叠圈、颜色越深），有运动的天在**环心**显示哑铃；以及今日餐次。（体重趋势不在这里，放在身体页。）
- **记录这一餐** —— **语音记录**（用 Web Speech API 说出你吃了什么、审阅文字、确认）、**拍照识别**（一点即开相机、AI 估营养）、**手动输入**——都先确认再写入。
- **AI 教练（对话）** —— 问它"我最近吃得怎么样""帮我安排今天剩下的饮食"，它会结合你的目标、今日摄入、近几天、运动记录和知识库回答；还能**通过工具调用帮你记饮食/运动**，且**先提议、你确认后才保存**。欢迎页有快捷示例，一点即问。
- **饮食记录** —— 带**分量换算的常用库**（存「鸡胸肉·100g=31g 蛋白」，下次记 `150g` 自动 ×1.5）、**拍照识别**、**RAG 营养查询**。
- **运动记录** —— 选类型 + 时长，按 MET×体重×时长**自动估算消耗**（可改）；有运动的日子在七日条与日历上显示哑铃标记。
- **个人知识库** —— 用键盘麦克风口述一句健身知识，AI 整理成干净的带标签条目；教练对话时会把**整个知识库**带进上下文，让建议贴合你自己的方法论（如碳循环）。每人一份、私有。
- **日历与历史** —— 月视图带每日卡路里环与运动标记，可点进某天编辑饮食/运动。
- **账号与云端同步** —— 邮箱密码登录；每个用户只能看到自己的数据（数据库级行级安全 RLS）。
- **我的** —— 个人卡（含推导的连续记录天数）、目标英雄区（真实每日目标 + 可选目标类型）、身体指标（身高/体重/BMI/体脂）、本月记录，以及**偏好设置弹层**（语言与主题在这里）。
- **双语与主题** —— 中/英、浅色/深色/跟随系统、千卡/千焦。
- **AI 供应商可切换** —— 改一行即可在 Gemini / OpenAI / Claude 之间切换。
- **AI 评测台** —— 对 RAG 查营养与助手工具调用做确定性判分，可本地跑或在 PR 上跑（仅提醒式 CI）。

### 🛠 技术栈

| 层 | 选型 |
|-----|------|
| 前端 | React 19、TypeScript、Vite、React Router |
| UI / 图表 | 自建设计系统（CSS 变量）、Recharts、`vite-plugin-pwa` |
| 数据与鉴权 | Supabase（Postgres、Auth、行级安全 RLS、**pgvector**） |
| AI | Vercel AI SDK（`ai`）+ `@ai-sdk/google`（默认 Gemini），可切换 OpenAI / Anthropic |
| 评测 | `tsx` 运行器 + GitHub Actions |
| 托管 | Vercel（静态前端 + Serverless 函数） |

### 🧱 架构亮点

- **密钥只在服务端。** AI 调用经由 `api/` 下的 Serverless 函数（及对应 Vite 开发中间件），API key 绝不下发浏览器。
- **先确认再写入的 AI。** 教练的工具只*提议*动作（记饮食/运动、存常用），客户端在你确认后经数据层执行 —— 服务端不写库、无需 JWT。
- **RAG 校准。** 食物名/照片对 pgvector 营养表（`match_foods`）做检索，命中可信时把估算校准到真实的每 100g 值。
- **一行切换模型**：顶部一个 `MODEL` 常量，其余代码借 Vercel AI SDK 与供应商无关。
- **行级安全** 在数据库层强制每用户隔离，而非只靠前端。
- **结构化输出**（Zod）让拍照识别与知识整理稳定返回类型正确的结果。

### 🚀 本地运行

```bash
# 1. 安装依赖
npm install

# 2. 建数据库（Supabase → SQL Editor，逐个运行）
#    supabase/schema.sql       建表 + RLS + 触发器（资料、饮食、体重、常用、运动）
#    supabase/rag.sql          pgvector 食物表 + match_foods（营养 RAG）
#    supabase/knowledge.sql    每人一份的知识表 + RLS
#    （可选）node --env-file=.env.local scripts/seed-foods.mjs   导入营养库

# 3. 配置环境变量
cp .env.example .env.local
#    VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY  （Supabase → Project Settings → API）
#    GOOGLE_GENERATIVE_AI_API_KEY               （https://aistudio.google.com/apikey）

# 4. 启动
npm run dev            # http://localhost:5173

# 5. （可选）跑 AI 评测
npm run eval           # 或：npm run eval -- lookup | assistant
```

### ☁️ 部署

开箱即可部署到 **Vercel**。导入仓库后在 *Project → Settings → Environment Variables* 加上上面三个变量即可；Vercel 自动识别 Vite 构建前端、把 `api/*.ts` 变成 Serverless 函数，每次 push 自动重部署。评测 CI 需要在 GitHub Actions Secrets 里加同样三个 key（别把该检查设为必需，让它仅提醒）。

### 📁 目录结构

```
api/            Serverless 函数（assistant / recognize / lookup / knowledge）+ 共用 lib/
src/
  pages/        今日、教练、记一餐、记运动、知识、身体、历史、
                日历、某天、我的（Settings）+ settings/{targets,profile}、登录
  components/   AppIcon、卡路里环、概览轮播、记餐入口、七日条、今日餐次、
                个人卡、目标英雄、身体指标、偏好弹层、宏量素条、进度环、底部导航、子页头、单位切换
  data/         Supabase 数据层 + 鉴权 context
  lib/          营养与运动计算、API 客户端、图片压缩 + 拍照手递、i18n、偏好、supabase 客户端
supabase/       schema.sql、rag.sql、knowledge.sql、migration-goal-type.sql
evals/          AI 评测台（数据集 + 运行器）
scripts/        营养库种子数据与脚本
```

> 路由用 `React.lazy` 代码分割；初始包只含「今日」与应用外壳。

---

<sub>Built by [@bohan0lin](https://github.com/bohan0lin) · Frontend, database, and AI integration.</sub>
