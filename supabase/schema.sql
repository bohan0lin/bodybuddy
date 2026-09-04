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
  goal_type text check (goal_type in ('recomposition', 'fat_loss', 'muscle_gain', 'maintenance', 'performance')), -- 可选健康目标类别
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
