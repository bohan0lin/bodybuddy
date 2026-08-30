-- ════════════════════════════════════════════════════════════
-- BodyBuddy · 健身/营养 文本知识库（pgvector 语义检索）
-- 与 foods 表并列：foods 存「食物→营养数字」，knowledge 存「方法论段落」
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全部 → Run（可重复运行）
-- 之后本地跑：node --env-file=.env.local scripts/seed-knowledge.mjs
-- ════════════════════════════════════════════════════════════

create extension if not exists vector;

-- 知识条目：每条是一段可独立理解的经验/方法（标题 + 正文 + 标签）
create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,          -- 简短主题，如「增肌减脂同时进行的蛋白摄入」
  content text not null,        -- 正文段落
  tags text,                    -- 逗号分隔标签，辅助检索（可空）
  embedding vector(768),        -- gemini-embedding-001，降维 768
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_embedding on public.knowledge
  using hnsw (embedding vector_cosine_ops);

-- RLS：登录用户可读（共享知识，非按用户）；写入由本地 seed 脚本用 service role 完成
alter table public.knowledge enable row level security;
drop policy if exists "read knowledge" on public.knowledge;
create policy "read knowledge" on public.knowledge for select using (true);

-- 语义检索：传查询向量，返回最相近的若干段 + 余弦距离
create or replace function public.match_knowledge(
  query_embedding vector(768),
  match_count int default 4
)
returns table (
  id uuid,
  title text,
  content text,
  tags text,
  distance float
)
language sql
stable
as $$
  select k.id, k.title, k.content, k.tags,
         (k.embedding <=> query_embedding) as distance
  from public.knowledge k
  where k.embedding is not null
  order by k.embedding <=> query_embedding
  limit match_count;
$$;
