-- La migración anterior (fix_household_members_rls_recursion) seguía usando
-- una subquery directa contra household_members dentro de su propia policy,
-- lo cual Postgres rechaza en tiempo de ejecución con:
--   "infinite recursion detected in policy for relation household_members"
-- (RLS no permite que una policy dependa de una subquery sobre la misma
-- tabla que esa policy protege, incluso con una rama OR sin subquery).
--
-- Fix estándar de Supabase: una función SECURITY DEFINER, propiedad de
-- "postgres" (dueño de las tablas), que lee household_members SIN pasar por
-- RLS (los dueños de tabla no están sujetos a sus propias policies salvo
-- FORCE ROW LEVEL SECURITY). Todas las policies multi-tenant referencian
-- esta función en vez de hacer la subquery directo.

create or replace function public.user_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

revoke all on function public.user_household_ids() from public;
grant execute on function public.user_household_ids() to authenticated;

drop policy "household members can view membership rows" on household_members;
create policy "household members can view membership rows"
  on household_members for select
  using (household_id in (select public.user_household_ids()));

drop policy "household members can view their household" on households;
create policy "household members can view their household"
  on households for select
  using (id in (select public.user_household_ids()));

drop policy "household members can manage accounts" on accounts;
create policy "household members can manage accounts"
  on accounts for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

drop policy "household members can manage categories" on categories;
create policy "household members can manage categories"
  on categories for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

drop policy "household members can manage budgets" on budgets;
create policy "household members can manage budgets"
  on budgets for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

drop policy "household members can manage transactions" on transactions;
create policy "household members can manage transactions"
  on transactions for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));
