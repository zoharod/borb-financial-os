-- Fase "Onboarding v3" — pedido explícito del usuario: el presupuesto no
-- alcanzaba para representar cuotas/financiamientos (obligación recurrente,
-- no un gasto de categoría) ni ingreso esperado (plata que todavía no llegó).
-- Ver domain.md "Compromisos financieros" e "Ingreso esperado".

create table financial_commitments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  amount numeric not null check (amount > 0), -- monto de la cuota, no el total financiado
  currency text not null check (currency in ('HNL', 'USD')),
  start_date date not null,
  end_date date null,
  remaining_installments int null check (remaining_installments >= 0),
  frequency text not null default 'monthly'
    check (frequency in ('weekly', 'biweekly', 'monthly', 'one_time')),
  next_payment_date date null,
  account_id uuid null references accounts(id) on delete set null, -- cuenta/tarjeta desde la que se paga
  category_id uuid null references categories(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now()
);

alter table financial_commitments enable row level security;

create policy "household members can view commitments"
  on financial_commitments for select
  using (household_id in (select public.user_household_ids()));

create policy "non-viewer members can write commitments"
  on financial_commitments for insert
  with check (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  );

create policy "non-viewer members can update commitments"
  on financial_commitments for update
  using (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  )
  with check (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  );

create policy "non-viewer members can delete commitments"
  on financial_commitments for delete
  using (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  );

create table expected_income (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  source text not null, -- "Salario", "Freelance", "Reembolso", ...
  amount numeric not null check (amount > 0),
  currency text not null check (currency in ('HNL', 'USD')),
  expected_date date not null,
  frequency text not null default 'monthly'
    check (frequency in ('weekly', 'biweekly', 'monthly', 'one_time')),
  household_member_user_id uuid null references auth.users(id) on delete set null,
  destination_account_id uuid null references accounts(id) on delete set null,
  status text not null default 'estimated' check (status in ('estimated', 'confirmed')),
  created_at timestamptz not null default now()
);

alter table expected_income enable row level security;

create policy "household members can view expected income"
  on expected_income for select
  using (household_id in (select public.user_household_ids()));

create policy "non-viewer members can write expected income"
  on expected_income for insert
  with check (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  );

create policy "non-viewer members can update expected income"
  on expected_income for update
  using (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  )
  with check (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  );

create policy "non-viewer members can delete expected income"
  on expected_income for delete
  using (
    household_id in (select public.user_household_ids())
    and public.user_household_role(household_id) <> 'viewer'
  );

-- Vincula el pago puntual de una cuota a su compromiso, sin duplicar la
-- compra original como un segundo gasto (ver domain.md).
alter table transactions
  add column commitment_id uuid null references financial_commitments(id) on delete set null;

alter table transactions drop constraint transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('income', 'expense', 'transfer', 'card_payment', 'refund', 'adjustment', 'financing_installment'));
