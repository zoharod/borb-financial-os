-- Modelo de datos para preferencias de notificación. No hay motor de envío
-- todavía (sin proveedor de email transaccional ni push) — estas columnas
-- solo guardan la preferencia del usuario para cuando esa fase se
-- implemente. Ver domain.md.
create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payment_reminders boolean not null default true,
  budget_alerts boolean not null default true,
  unusual_transaction_alerts boolean not null default true,
  savings_milestones boolean not null default true,
  cashback_opportunities boolean not null default false,
  weekly_summary boolean not null default false,
  monthly_summary boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "users can view their own notification preferences"
  on notification_preferences for select
  using (user_id = auth.uid());

create policy "users can upsert their own notification preferences"
  on notification_preferences for insert
  with check (user_id = auth.uid());

create policy "users can update their own notification preferences"
  on notification_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
