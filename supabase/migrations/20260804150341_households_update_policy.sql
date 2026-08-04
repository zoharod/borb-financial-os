-- Bug real (onboarding v2): households solo tenía policy de SELECT. Cualquier
-- UPDATE de onboarding_step desde el cliente (useUpdateOnboardingStep) era
-- bloqueado en silencio por RLS (default deny), así que el wizard nunca
-- avanzaba de 'accounts' pase lo que pase en la UI. Mismo patrón que el resto
-- del proyecto: household_id (acá, id) IN user_household_ids().
create policy "household members can update their household"
  on households
  for update
  using (id in (select public.user_household_ids()))
  with check (id in (select public.user_household_ids()));
