-- Fase 1-C — Integridad Financiera. Ver architecture.md
-- "Transferencias y tipos de transacción (Fase 1-C)" para el diseño completo.

-- Tercer tipo de cuenta: modela una tarjeta de crédito lo suficiente como
-- para diferenciar "pago de tarjeta" de una transferencia genérica, sin
-- construir el módulo de Tarjetas completo (eso sigue siendo Fase 2).
alter table accounts drop constraint accounts_type_check;
alter table accounts add constraint accounts_type_check
  check (type in ('checking', 'savings', 'credit_card'));

-- Cuenta destino de transfer/card_payment. Antes transactions solo tenía
-- account_id, así que una transferencia no podía registrar a dónde iba la
-- plata — quedaba tratada como una salida sin contraparte.
alter table transactions add column to_account_id uuid references accounts (id);

alter table transactions drop constraint transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('income', 'expense', 'transfer', 'card_payment', 'refund', 'adjustment'));

-- Validación de integridad a nivel de base (no depende de que la app nunca
-- tenga un bug): cuentas del mismo household, monedas coincidentes, y
-- to_account_id presente solo cuando el tipo lo requiere.
create or replace function public.validate_transaction_accounts()
returns trigger
language plpgsql
as $$
declare
  from_household uuid;
  from_currency text;
  to_household uuid;
  to_currency text;
begin
  select household_id, currency into from_household, from_currency
  from accounts where id = new.account_id;

  if from_household is null or from_household != new.household_id then
    raise exception 'account_id does not belong to household_id';
  end if;

  if new.type in ('transfer', 'card_payment') then
    if new.to_account_id is null then
      raise exception 'to_account_id is required for type %', new.type;
    end if;

    if new.to_account_id = new.account_id then
      raise exception 'to_account_id must differ from account_id';
    end if;

    select household_id, currency into to_household, to_currency
    from accounts where id = new.to_account_id;

    if to_household is null or to_household != new.household_id then
      raise exception 'to_account_id does not belong to household_id';
    end if;

    if to_currency != new.currency then
      raise exception 'to_account_id currency (%) does not match transaction currency (%)', to_currency, new.currency;
    end if;
  elsif new.to_account_id is not null then
    raise exception 'to_account_id must be null for type %', new.type;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_transaction_accounts_trigger on transactions;
create trigger validate_transaction_accounts_trigger
  before insert or update on transactions
  for each row execute function public.validate_transaction_accounts();
