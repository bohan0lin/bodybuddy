-- Make access reproducible across projects with different default privileges.
-- RLS policies still enforce ownership for every authenticated table operation.
grant usage on schema public to anon, authenticated;
revoke all on public.profiles, public.weight_logs, public.meals,
  public.workouts, public.saved_items, public.knowledge from anon;
grant select, insert, update, delete on public.profiles, public.weight_logs,
  public.meals, public.workouts, public.saved_items, public.knowledge to authenticated;
revoke all on public.foods from anon, authenticated;
grant select on public.foods to anon, authenticated;
grant execute on function public.match_foods(vector, integer) to anon, authenticated;
