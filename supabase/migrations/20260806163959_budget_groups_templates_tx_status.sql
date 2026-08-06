-- Feedback de producto: presupuesto agrupado en secciones + plantillas
-- reusables, y estados reales de transacción (hoy 'status' existe pero
-- ninguna query lo respeta - hasta 'pending' cuenta como plata real).

alter table categories add column group_name text;
alter table categories add constraint categories_group_name_check check (
  group_name is null or group_name in (
    'vivienda', 'transporte', 'salud', 'comida', 'suscripciones',
    'personal', 'inversiones', 'deuda', 'ahorro', 'extras', 'fondos_anuales'
  )
);

alter table transactions drop constraint transactions_status_check;
alter table transactions add constraint transactions_status_check check (
  status in ('pending', 'scheduled', 'confirmed', 'reconciled', 'cancelled')
);

create table budget_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table budget_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references budget_templates(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  category_name text,
  planned_amount numeric not null,
  currency text not null check (currency in ('HNL', 'USD')),
  created_at timestamptz not null default now()
);

alter table budget_templates enable row level security;
alter table budget_template_items enable row level security;

create policy "household members can view budget templates"
  on budget_templates for select
  using (household_id in (select public.user_household_ids()));

create policy "non-viewer members can write budget templates"
  on budget_templates for all
  using (household_id in (select public.user_household_ids()) and public.user_household_role(household_id) <> 'viewer')
  with check (household_id in (select public.user_household_ids()) and public.user_household_role(household_id) <> 'viewer');

create policy "household members can view budget template items"
  on budget_template_items for select
  using (template_id in (select id from budget_templates where household_id in (select public.user_household_ids())));

create policy "non-viewer members can write budget template items"
  on budget_template_items for all
  using (template_id in (select id from budget_templates where household_id in (select public.user_household_ids()) and public.user_household_role(household_id) <> 'viewer'))
  with check (template_id in (select id from budget_templates where household_id in (select public.user_household_ids()) and public.user_household_role(household_id) <> 'viewer'));
