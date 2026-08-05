-- RPCs SECURITY DEFINER para las acciones de membresía que necesitan
-- validaciones cruzadas (email de auth.users, invariantes de "un solo
-- owner") que una policy RLS declarativa no puede expresar con seguridad.
-- Cambiar de rol es un UPDATE simple (RLS declarativa, ver migración de
-- policies); invitar/aceptar/remover/transferir/salir van acá.

create or replace function public.create_household_invitation(
  target_household_id uuid,
  target_email text,
  target_role text,
  target_message text default null
)
returns household_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  existing_user_id uuid;
  new_invitation household_invitations;
  normalized_email text := lower(trim(target_email));
begin
  caller_role := public.user_household_role(target_household_id);
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'not authorized to invite members to this household';
  end if;
  if target_role not in ('admin', 'member', 'viewer') then
    raise exception 'invalid role';
  end if;

  select id into existing_user_id from auth.users where lower(email) = normalized_email;
  if existing_user_id is not null and exists (
    select 1 from household_members
    where household_id = target_household_id and user_id = existing_user_id
  ) then
    raise exception 'this person is already a member of this household';
  end if;

  if exists (
    select 1 from household_invitations
    where household_id = target_household_id
      and lower(email) = normalized_email
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception 'there is already a pending invitation for this email';
  end if;

  insert into household_invitations (household_id, email, role, invited_by, message)
  values (target_household_id, normalized_email, target_role, auth.uid(), target_message)
  returning * into new_invitation;

  return new_invitation;
end;
$$;

revoke all on function public.create_household_invitation(uuid, text, text, text) from public;
grant execute on function public.create_household_invitation(uuid, text, text, text) to authenticated;

create or replace function public.accept_household_invitation(target_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv household_invitations;
  caller_email text;
  caller_current_household uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from household_invitations where token = target_token;
  if inv is null then
    raise exception 'invitation not found';
  end if;
  if inv.status = 'accepted' then
    raise exception 'this invitation was already used';
  end if;
  if inv.status = 'cancelled' then
    raise exception 'this invitation was cancelled';
  end if;
  if inv.expires_at < now() then
    update household_invitations set status = 'expired' where id = inv.id;
    raise exception 'this invitation has expired';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  if lower(caller_email) != lower(inv.email) then
    raise exception 'this invitation was sent to a different email address';
  end if;

  select household_id into caller_current_household
  from household_members where user_id = auth.uid() limit 1;

  if caller_current_household is not null and caller_current_household != inv.household_id then
    raise exception 'you already belong to another household';
  end if;

  if caller_current_household is null then
    insert into household_members (household_id, user_id, role)
    values (inv.household_id, auth.uid(), inv.role);
  end if;

  update household_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = inv.id;

  return inv.household_id;
end;
$$;

revoke all on function public.accept_household_invitation(uuid) from public;
grant execute on function public.accept_household_invitation(uuid) to authenticated;

create or replace function public.remove_household_member(target_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target household_members;
  caller_role text;
begin
  select * into target from household_members where id = target_member_id;
  if target is null then
    raise exception 'member not found';
  end if;
  if target.user_id = auth.uid() then
    raise exception 'use leave_household to remove yourself';
  end if;

  caller_role := public.user_household_role(target.household_id);
  if caller_role = 'owner' and target.role != 'owner' then
    delete from household_members where id = target_member_id;
    return;
  end if;
  if caller_role = 'admin' and target.role in ('member', 'viewer') then
    delete from household_members where id = target_member_id;
    return;
  end if;

  raise exception 'not authorized to remove this member';
end;
$$;

revoke all on function public.remove_household_member(uuid) from public;
grant execute on function public.remove_household_member(uuid) to authenticated;

create or replace function public.leave_household(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := public.user_household_role(target_household_id);
  if caller_role is null then
    raise exception 'you are not a member of this household';
  end if;
  if caller_role = 'owner' then
    raise exception 'transfer ownership before leaving, or delete the household instead';
  end if;

  delete from household_members
  where household_id = target_household_id and user_id = auth.uid();
end;
$$;

revoke all on function public.leave_household(uuid) from public;
grant execute on function public.leave_household(uuid) to authenticated;

create or replace function public.transfer_household_ownership(
  target_household_id uuid,
  new_owner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_household_role(target_household_id) != 'owner' then
    raise exception 'only the current owner can transfer ownership';
  end if;
  if not exists (
    select 1 from household_members
    where household_id = target_household_id and user_id = new_owner_user_id
  ) then
    raise exception 'the new owner must already be a member of this household';
  end if;

  update household_members set role = 'owner'
  where household_id = target_household_id and user_id = new_owner_user_id;
  update household_members set role = 'admin'
  where household_id = target_household_id and user_id = auth.uid();
end;
$$;

revoke all on function public.transfer_household_ownership(uuid, uuid) from public;
grant execute on function public.transfer_household_ownership(uuid, uuid) to authenticated;

create or replace function public.delete_household(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_household_role(target_household_id) != 'owner' then
    raise exception 'only the owner can delete the household';
  end if;
  delete from households where id = target_household_id;
end;
$$;

revoke all on function public.delete_household(uuid) from public;
grant execute on function public.delete_household(uuid) to authenticated;
