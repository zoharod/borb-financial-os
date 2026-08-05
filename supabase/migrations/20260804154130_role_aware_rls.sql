-- Antes de esto, cualquier miembro del household (sin importar rol) podía
-- escribir en las 5 tablas financieras (policy única "ALL"). Ahora que
-- existe el rol 'viewer' (solo lectura), cada tabla se separa en 2
-- policies: SELECT para cualquier miembro, INSERT/UPDATE/DELETE solo para
-- 'owner'/'admin'/'member'.
do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'categories', 'budgets', 'transactions', 'cards']
  loop
    execute format('drop policy "household members can manage %s" on %I', t, t);

    execute format(
      'create policy "household members can view %s" on %I for select using (household_id in (select public.user_household_ids()))',
      t, t
    );
    execute format(
      'create policy "non-viewer members can write %s" on %I for insert with check (household_id in (select public.user_household_ids()) and public.user_household_role(household_id) != ''viewer'')',
      t, t
    );
    execute format(
      'create policy "non-viewer members can update %s" on %I for update using (household_id in (select public.user_household_ids()) and public.user_household_role(household_id) != ''viewer'') with check (household_id in (select public.user_household_ids()) and public.user_household_role(household_id) != ''viewer'')',
      t, t
    );
    execute format(
      'create policy "non-viewer members can delete %s" on %I for delete using (household_id in (select public.user_household_ids()) and public.user_household_role(household_id) != ''viewer'')',
      t, t
    );
  end loop;
end $$;

-- Cambiar de rol es un UPDATE declarativo (a diferencia de invitar/remover/
-- transferir, no necesita una función SECURITY DEFINER): owner o admin
-- pueden cambiar el rol de OTRO miembro (nunca el propio, evita
-- auto-ascenso); admin no puede ascender a otro a 'admin' (ni a 'owner',
-- que además está prohibido para cualquiera vía este camino — ver
-- transfer_household_ownership).
create policy "owner or admin can change other members role"
  on household_members for update
  using (
    household_id in (select public.user_household_ids())
    and user_id != auth.uid()
    and public.user_household_role(household_id) in ('owner', 'admin')
  )
  with check (
    role in ('admin', 'member', 'viewer')
    and (
      public.user_household_role(household_id) = 'owner'
      or role in ('member', 'viewer')
    )
  );

-- households: solo owner/admin puede renombrar/ajustar preferencias.
-- Reemplaza la policy de UPDATE agregada para onboarding_step (esa no
-- distinguía rol porque en ese momento todo household tenía 1 solo dueño).
drop policy "household members can update their household" on households;

create policy "owner or admin can update household"
  on households for update
  using (id in (select public.user_household_ids()) and public.user_household_role(id) in ('owner', 'admin'))
  with check (id in (select public.user_household_ids()) and public.user_household_role(id) in ('owner', 'admin'));
