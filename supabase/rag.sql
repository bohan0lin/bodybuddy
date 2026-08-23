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
