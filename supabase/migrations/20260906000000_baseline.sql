-- Canonical baseline. Legacy root SQL files are archived references only.
-- ════════════════════════════════════════════════════════════
-- BodyBuddy · Supabase 数据库结构
-- 用法：Supabase 控制台 → SQL Editor → 新建查询 → 粘贴全部 → Run
-- 可重复运行（幂等）。
-- ════════════════════════════════════════════════════════════

-- ── 个人资料（每日目标等）──────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '我',
  height_cm numeric not null default 0,
  target_protein numeric not null default 0,
  target_carbs numeric not null default 0,
  target_fat numeric not null default 0,
  target_calories numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ── 体重 / 体脂记录（每人每天一条）──────────────────────
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight numeric not null,
  body_fat numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ── 餐食记录 ────────────────────────────────────────────
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type text not null,
  name text not null,
  amount numeric,
  unit text,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  calories numeric not null default 0,
  photo_url text,
  created_at timestamptz not null default now()
);

-- ── 运动记录 ────────────────────────────────────────────
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type text not null,               -- 活动类型 key（strength/run/…）
  note text,                        -- 备注（练了什么部位）
  duration_min numeric not null default 0,
  calories numeric not null default 0,   -- 估算消耗千卡
  created_at timestamptz not null default now()
);

-- ── 常用食物 / 套餐库 ───────────────────────────────────
create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,               -- 'food' | 'meal'
  name text not null,
  unit text not null default 'g',
  base_amount numeric not null default 100,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  calories numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_weight_user on public.weight_logs (user_id, date);
create index if not exists idx_meals_user on public.meals (user_id, date);
create index if not exists idx_saved_user on public.saved_items (user_id);
create index if not exists idx_workouts_user on public.workouts (user_id, date);

-- ── 行级安全（RLS）：每人只能读写自己的数据 ──────────────
alter table public.profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.meals enable row level security;
alter table public.saved_items enable row level security;
alter table public.workouts enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own weights" on public.weight_logs;
create policy "own weights" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own saved" on public.saved_items;
create policy "own saved" on public.saved_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 注册时自动创建 profile 行 ───────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- BodyBuddy · 健身/营养 知识库（每人一份，纯文本，无向量）
-- 个人知识条目量小，直接整库喂给 AI 教练，无需向量检索
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全部 → Run（可重复运行）
-- ════════════════════════════════════════════════════════════

create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,        -- 简短主题
  content text not null,      -- 正文（AI 整理后的知识）
  tags text,                  -- 逗号分隔标签（可空）
  created_at timestamptz not null default now(),
  unique (user_id, title)     -- 同一用户同标题去重，便于 seed 追加
);

create index if not exists idx_knowledge_user on public.knowledge (user_id);

-- RLS：每人只能读写自己的知识
alter table public.knowledge enable row level security;
drop policy if exists "read knowledge" on public.knowledge;   -- 清理旧的共享读策略
drop policy if exists "own knowledge" on public.knowledge;
create policy "own knowledge" on public.knowledge
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- BodyBuddy · RAG 营养库（pgvector 语义检索）
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全部 → Run（可重复运行）
-- 之后本地跑 scripts/seed-foods.mjs 导入数据并生成向量
-- ════════════════════════════════════════════════════════════

-- 1) 启用向量扩展
create extension if not exists vector;

-- 2) 食物营养表（每 base_amount 单位的营养值；共享参考表，非按用户）
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,              -- 中文名（规范）
  name_en text,                    -- 英文名
  aliases text,                    -- 别名，逗号分隔（用于检索）
  unit text not null default 'g',  -- g / ml
  base_amount numeric not null default 100,
  protein numeric not null,        -- 每 base_amount 的克数
  carbs numeric not null,
  fat numeric not null,
  calories numeric not null,       -- 每 base_amount 的千卡
  embedding vector(768),           -- gemini-embedding-001，降维到 768
  created_at timestamptz not null default now()
);

-- 3) 向量近邻索引（余弦）
create index if not exists idx_foods_embedding on public.foods
  using hnsw (embedding vector_cosine_ops);

-- 4) RLS：所有人可读（共享参考数据），写入由服务端 seed 脚本用 service role 完成
alter table public.foods enable row level security;
drop policy if exists "read foods" on public.foods;
create policy "read foods" on public.foods for select using (true);

-- 5) 语义检索函数：传入查询向量，返回最相近的若干条 + 余弦距离
create or replace function public.match_foods(
  query_embedding vector(768),
  match_count int default 3
)
returns table (
  id uuid,
  name text,
  name_en text,
  unit text,
  base_amount numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  calories numeric,
  distance float
)
language sql
stable
as $$
  select f.id, f.name, f.name_en, f.unit, f.base_amount,
         f.protein, f.carbs, f.fat, f.calories,
         (f.embedding <=> query_embedding) as distance
  from public.foods f
  where f.embedding is not null
  order by f.embedding <=> query_embedding
  limit match_count;
$$;
