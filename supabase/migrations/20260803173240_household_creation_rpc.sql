-- Onboarding: un usuario recién autenticado (ej. via Google OAuth) no
-- pertenece a ningún household_members todavía, así que no puede insertar
-- su propio household ni membership desde el cliente (RLS lo bloquea: no
-- hay policy de INSERT en households, y la de household_members exige ya
-- pertenecer a un household). Mismo patrón que public.user_household_ids()
-- (ver architecture.md "Multi-tenancy"): una función SECURITY DEFINER que
-- bypassea RLS para este caso puntual y controlado.

create or replace function public.create_household_for_current_user(household_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'user already belongs to a household';
  end if;

  insert into households (name) values (household_name) returning id into new_household_id;
  insert into household_members (household_id, user_id, role) values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

revoke all on function public.create_household_for_current_user(text) from public;
grant execute on function public.create_household_for_current_user(text) to authenticated;
