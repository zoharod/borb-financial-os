-- cards.cardholder era texto libre — pedido explícito del usuario: debe ser
-- un miembro real del hogar (selector, no texto), para poder saber a quién
-- pertenece cada tarjeta. Ver domain.md "Tarjetahabiente".
alter table cards add column cardholder_user_id uuid null references auth.users(id) on delete set null;

-- Backfill: cards.cardholder ya tenía datos reales de producción ("Zohar",
-- "Leo"). Se intenta matchear contra el nombre de un miembro real del MISMO
-- household (coincidencia por prefijo, insensible a mayúsculas) — cubre el
-- caso normal (nombre corto que es el inicio del nombre completo). Lo que no
-- matchea (ej. "Leo", que todavía no había sido invitado al hogar) se
-- conserva como texto en legacy_cardholder_name en vez de perderse.
update cards c
set cardholder_user_id = p.id
from household_members hm
join profiles p on p.id = hm.user_id
where hm.household_id = c.household_id
  and c.cardholder is not null
  and p.full_name ilike c.cardholder || '%';

alter table cards rename column cardholder to legacy_cardholder_name;

comment on column cards.legacy_cardholder_name is
  'Texto libre pre-migración que no pudo matchearse a un household_member real (ver migración 20260804163200). Mostrar como sugerencia hasta que alguien lo reemplace por cardholder_user_id.';
