-- Synthetic pre-brand/pre-goal schema fixture. Used ONLY inside a rollback-only
-- transaction by scripts/db/upgrade.mjs after checking the local Docker container.
alter table public.profiles drop column goal_type;
alter table public.meals drop column brand;
alter table public.saved_items drop column brand;
-- Deliberately nonzero old defaults exercise the zero-default migration.
alter table public.profiles alter column height_cm set default 170;
alter table public.profiles alter column target_protein set default 100;
alter table public.profiles alter column target_carbs set default 200;
alter table public.profiles alter column target_fat set default 60;
alter table public.profiles alter column target_calories set default 2000;
