-- Roles ampliados: owner (todo) > admin (gestiona datos + invita) > member
-- (gestiona datos) > viewer (solo lectura). Filas existentes son 'owner' o
-- 'member', ambos valores siguen siendo válidos.
alter table household_members drop constraint household_members_role_check;
alter table household_members add constraint household_members_role_check
  check (role in ('owner', 'admin', 'member', 'viewer'));

-- Helper para RLS role-aware, mismo patrón que user_household_ids(): lee
-- household_members sin volver a pasar por RLS (evita recursión).
create or replace function public.user_household_role(target_household_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from household_members
  where household_id = target_household_id and user_id = auth.uid()
$$;

revoke all on function public.user_household_role(uuid) from public;
grant execute on function public.user_household_role(uuid) to authenticated;

alter table households
  add column avatar_url text,
  add column financial_month_start_day int not null default 1 check (financial_month_start_day between 1 and 28),
  add column default_budget_period text not null default 'monthly' check (default_budget_period in ('monthly', 'biweekly'));

create table household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member', 'viewer')),
  invited_by uuid not null references auth.users(id),
  message text,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table household_invitations enable row level security;

-- Solo owner/admin del hogar ven y gestionan sus propias invitaciones
-- pendientes. No hay policy que permita ver invitaciones por email/token sin
-- pertenecer al hogar — la pantalla de aceptación usa la función
-- accept_household_invitation (SECURITY DEFINER) en vez de una query directa,
-- así el token no expone datos del hogar antes de aceptar.
create policy "owner or admin can view household invitations"
  on household_invitations for select
  using (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) in ('owner', 'admin')
  );

create policy "owner or admin can create household invitations"
  on household_invitations for insert
  with check (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) in ('owner', 'admin')
    and invited_by = auth.uid()
  );

create policy "owner or admin can update household invitations"
  on household_invitations for update
  using (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) in ('owner', 'admin')
  );

create policy "owner or admin can delete household invitations"
  on household_invitations for delete
  using (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) in ('owner', 'admin')
  );

create index household_invitations_email_idx on household_invitations (email);
create index household_invitations_household_id_idx on household_invitations (household_id);
