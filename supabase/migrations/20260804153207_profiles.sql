-- Perfil de usuario, 1:1 con auth.users. No duplica nada que Supabase Auth
-- ya guarde (email, password, proveedor) — solo preferencias propias de la
-- app. Se crea automáticamente vía trigger en auth.users, así que cualquier
-- camino de alta (Google OAuth, email/password, invitación aceptada) tiene
-- fila desde el primer momento, sin depender de que la app la cree a mano.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_language text not null default 'es',
  timezone text not null default 'America/Tegucigalpa',
  date_format text not null default 'DD/MM/YYYY' check (date_format in ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  number_format text not null default 'es-HN',
  preferred_currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "users can view their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "users can update their own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Household members necesitan ver el nombre/avatar de sus compañeros de
-- hogar (lista de miembros), no solo el propio.
create policy "household members can view co-members profiles"
  on profiles for select
  using (
    id in (
      select hm.user_id
      from household_members hm
      where hm.household_id in (select public.user_household_ids())
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuarios que ya existían antes de este trigger.
insert into public.profiles (id, full_name, avatar_url)
select id, raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;
