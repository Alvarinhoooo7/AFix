-- Cierra la API REST autogenerada de Supabase (PostgREST) sobre las tablas de AFIX.
-- La app se conecta directo a Postgres con el rol duenio, que ignora RLS, asi que
-- nada de la app depende de estos permisos. Sin politicas permisivas, anon y
-- authenticated no pueden leer ni escribir nada.

alter table equipo enable row level security;
alter table ficha enable row level security;
alter table ajustes_taller enable row level security;

revoke all on table equipo, ficha, ajustes_taller from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Tablas futuras creadas por el rol duenio no heredan permisos para anon ni authenticated.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
