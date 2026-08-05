-- Onboarding gana 2 pasos opcionales entre presupuesto y revisión: Compromisos
-- financieros e Ingreso esperado (ver domain.md). No hace falta backfill: un
-- household ya en 'budget'/'review'/'done' sigue siendo un valor válido, y
-- STEP_ORDER en el cliente ya sabe insertar los pasos nuevos en el medio.
alter table households drop constraint households_onboarding_step_check;
alter table households add constraint households_onboarding_step_check
  check (onboarding_step in ('household', 'accounts', 'cards', 'budget', 'commitments', 'income', 'review', 'done'));
