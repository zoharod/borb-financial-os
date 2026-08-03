-- La policy original de household_members (select) sólo comprobaba
-- "household_id in (select ... where user_id = auth.uid())", una subquery
-- contra la MISMA tabla protegida por la MISMA policy, sin ningún caso base
-- anclado directamente a auth.uid(). Sin caso base, Postgres no puede resolver
-- visibilidad para ninguna fila (recursión sin punto de apoyo) y toda
-- consulta devuelve 0 filas, aunque el usuario sí sea miembro del household.
--
-- Fix: agregar "user_id = auth.uid()" como rama directa (sin subquery) para
-- que la fila propia sea siempre visible, lo cual además sirve de caso base
-- para que la subquery de esta misma policy (y las de accounts/categories/
-- budgets/transactions/households, que dependen de leer household_members)
-- puedan resolver correctamente.

drop policy "household members can view membership rows" on household_members;

create policy "household members can view membership rows"
  on household_members for select
  using (
    user_id = auth.uid()
    or household_id in (
      select household_id from household_members where user_id = auth.uid()
    )
  );
