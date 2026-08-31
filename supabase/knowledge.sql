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
