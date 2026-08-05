-- PostgREST necesita una FK directa entre 2 tablas para poder hacer
-- embedding (select "*, profiles(...)" desde household_members). Ambas
-- columnas ya apuntan a auth.users, pero eso no alcanza — PostgREST no ve
-- el schema auth, así que no infiere la relación indirecta. Se agrega esta
-- segunda FK (mismo valor, otro destino) solo para que PostgREST pueda
-- resolver el embed; no cambia ninguna regla de negocio.
alter table household_members
  add constraint household_members_user_id_profiles_fkey
  foreign key (user_id) references profiles(id) on delete cascade;
