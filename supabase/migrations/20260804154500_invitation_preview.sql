-- La pantalla /invite/[token] necesita mostrar a quién invitaron, a qué
-- hogar y con qué rol ANTES de aceptar — en ese momento el usuario todavía
-- no es miembro del household, así que la policy normal de SELECT de
-- household_invitations (solo owner/admin) lo bloquea, y no debe poder leer
-- households/accounts directamente (expondría datos financieros del hogar
-- antes de aceptar). Esta función devuelve solo lo mínimo necesario para la
-- pantalla de confirmación.
create or replace function public.get_invitation_preview(target_token uuid)
returns table (
  household_name text,
  role text,
  status text,
  expires_at timestamptz,
  invited_by_name text,
  message text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    h.name,
    i.role,
    case when i.status = 'pending' and i.expires_at < now() then 'expired' else i.status end,
    i.expires_at,
    p.full_name,
    i.message
  from household_invitations i
  join households h on h.id = i.household_id
  left join profiles p on p.id = i.invited_by
  where i.token = target_token
$$;

revoke all on function public.get_invitation_preview(uuid) from public;
grant execute on function public.get_invitation_preview(uuid) to authenticated, anon;
