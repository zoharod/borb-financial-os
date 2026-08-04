-- households.onboarding_step (migración anterior) arrancó en 'household'
-- por default para TODAS las filas existentes, incluidas las que ya
-- pasaron por el onboarding viejo de 1 solo paso (ej. Casa Test B, con
-- cuentas/categorías/transacciones reales de Fase 1-C) — sin este backfill
-- volverían a ver el wizard desde cero. Heurística: si ya tiene al menos
-- una cuenta o una categoría, se considera "ya onboardeado".
update households
set onboarding_step = 'done'
where onboarding_step = 'household'
  and (
    exists (select 1 from accounts where accounts.household_id = households.id)
    or exists (select 1 from categories where categories.household_id = households.id)
  );
