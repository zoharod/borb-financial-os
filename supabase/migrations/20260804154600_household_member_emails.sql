-- La pantalla de Miembros del hogar necesita mostrar el email de cada
-- miembro (el nombre de perfil puede estar vacío o repetido). auth.users no
-- se expone vía PostgREST, así que en vez de una API route con la service
-- role key, una función SECURITY DEFINER puede leerlo directamente (mismo
-- patrón que el resto del proyecto) sin duplicar el email en una tabla propia.
create or replace function public.get_household_member_emails(target_household_id uuid)
returns table (user_id uuid, email text)
language sql
security definer
stable
set search_path = public
as $$
  select hm.user_id, u.email
  from household_members hm
  join auth.users u on u.id = hm.user_id
  where hm.household_id = target_household_id
    and target_household_id in (select public.user_household_ids())
$$;

revoke all on function public.get_household_member_emails(uuid) from public;
grant execute on function public.get_household_member_emails(uuid) to authenticated;
