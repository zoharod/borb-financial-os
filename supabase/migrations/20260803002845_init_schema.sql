-- Fase 0/1 — schema inicial de Borb Financial OS.
-- Fuente de verdad: docs/architecture.md. No modificar sin actualizar ese archivo primero.

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency_default text not null default 'HNL',
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  currency text not null check (currency in ('HNL', 'USD')),
  type text not null check (type in ('checking', 'savings')),
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  is_extra_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  month date not null,
  planned_amount numeric not null,
  currency text not null check (currency in ('HNL', 'USD')),
  unique (household_id, category_id, month)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  account_id uuid not null references accounts (id) on delete cascade,
  category_id uuid references categories (id) on delete set null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric not null,
  currency text not null check (currency in ('HNL', 'USD')),
  description text,
  transaction_date date not null,
  created_by uuid not null references auth.users (id),
  status text not null default 'confirmed' check (status in ('confirmed', 'pending')),
  -- Reservadas para fases futuras (ver architecture.md) — no eliminar.
  source text not null default 'manual' check (source in ('manual', 'csv', 'email', 'ocr', 'sms')),
  card_id uuid,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on household_members (user_id);
create index on accounts (household_id);
create index on categories (household_id);
create index on budgets (household_id, month);
create index on transactions (household_id, transaction_date);
create index on transactions (account_id);

-- RLS: obligatorio en toda tabla de datos desde el día 1 (ver CLAUDE.md).
alter table households enable row level security;
alter table household_members enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table budgets enable row level security;
alter table transactions enable row level security;

create policy "household members can view their household"
  on households for select
  using (
    id in (select household_id from household_members where user_id = auth.uid())
  );

create policy "household members can view membership rows"
  on household_members for select
  using (
    household_id in (select household_id from household_members where user_id = auth.uid())
  );

create policy "household members can manage accounts"
  on accounts for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

create policy "household members can manage categories"
  on categories for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

create policy "household members can manage budgets"
  on budgets for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));

create policy "household members can manage transactions"
  on transactions for all
  using (household_id in (select household_id from household_members where user_id = auth.uid()))
  with check (household_id in (select household_id from household_members where user_id = auth.uid()));
