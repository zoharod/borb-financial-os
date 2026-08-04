-- Refinamiento de onboarding. Ver docs/domain.md y architecture.md
-- "Onboarding refinado (cuentas múltiples, tarjetas, presupuesto)".

-- Tarjetas: entidad separada de accounts (ver domain.md — por qué no
-- meter esto en accounts). Cada tarjeta puede tener 1-2 cuentas
-- (accounts.card_id abajo), una por moneda que maneje.
create table cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  bank text,
  cardholder text,
  network text check (network in ('visa', 'mastercard', 'amex', 'other')),
  last4 text,
  credit_limit numeric,
  statement_closing_day int check (statement_closing_day between 1 and 31),
  payment_due_day int check (payment_due_day between 1 and 31),
  minimum_payment numeric,
  full_payment_amount numeric,
  created_at timestamptz not null default now()
);

create index on cards (household_id);

alter table cards enable row level security;

create policy "household members can manage cards"
  on cards for all
  using (household_id in (select public.user_household_ids()))
  with check (household_id in (select public.user_household_ids()));

-- Vincula una cuenta tipo credit_card a la tarjeta a la que pertenece.
alter table accounts add column card_id uuid references cards (id) on delete set null;
alter table accounts add column institution text;

-- Onboarding de varios pasos (cuentas y tarjetas son repetibles/opcionales,
-- así que ya no alcanza con inferir "terminó" solo mirando si hay datos).
alter table households add column onboarding_step text not null default 'household'
  check (onboarding_step in ('household', 'accounts', 'cards', 'budget', 'review', 'done'));
alter table households add column secondary_currency text check (secondary_currency in ('HNL', 'USD'));

-- Se reemplaza por la versión de 3 argumentos de abajo (evita que quede una
-- versión vieja "muda" respecto a moneda/onboarding_step que alguien llame
-- por error).
drop function if exists public.create_household_for_current_user(text);

-- Amplía la función de Fase 1-C: ahora también recibe la moneda primaria y
-- secundaria del Paso 1, y deja el household en onboarding_step='accounts'
-- (el paso 1 ya quedó completo en cuanto esto se ejecuta con éxito).
create or replace function public.create_household_for_current_user(
  household_name text,
  primary_currency text default 'HNL',
  household_secondary_currency text default null
)
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

  insert into households (name, base_currency_default, secondary_currency, onboarding_step)
  values (household_name, primary_currency, household_secondary_currency, 'accounts')
  returning id into new_household_id;

  insert into household_members (household_id, user_id, role) values (new_household_id, auth.uid(), 'owner');

  return new_household_id;
end;
$$;

revoke all on function public.create_household_for_current_user(text, text, text) from public;
grant execute on function public.create_household_for_current_user(text, text, text) to authenticated;
