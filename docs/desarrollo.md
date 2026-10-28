# Desarrollo local

## Requisitos para correr las pruebas

1. Tener Docker activo y el CLI de `supabase` en el `PATH`.
2. Levantar el stack local con `supabase start`.
3. Definir `DATABASE_URL` y `TEST_DATABASE_URL` en `.env.local` (puedes copiar `.env.example`).

## Base de datos local: solo datos de prueba

`supabase start` levanta Postgres en Docker y publica sus puertos en `0.0.0.0`, es
decir, accesibles desde la red Wi-Fi, con la contraseña por omisión `postgres`. El CLI
no ofrece una forma limpia de dejarlos solo en `127.0.0.1`, y se acepta para desarrollo.

Por eso la base local **nunca debe contener registros reales**: ni equipos, ni nombres,
ni teléfonos de clientes. Los datos reales viven en Supabase cloud, que `supabase start`
no expone. Tampoco se instalan reglas de firewall ni overrides de Docker.

Las tablas además tienen RLS activado y sin permisos para `anon` ni `authenticated`
(migración `0003`), y Auth, Storage, Realtime, Studio, Inbucket y Analytics están
desactivados en `supabase/config.toml`.

## Pruebas

`npm test` usa `TEST_DATABASE_URL` (ver `.env.example`), una base distinta de
`DATABASE_URL` cuyo nombre debe terminar en `_test`. En cada corrida se borra, se
recrea y se le aplican las migraciones con `supabase migration up --db-url`. La
configuración de Vitest se niega a correr si falta la variable o si es igual a
`DATABASE_URL`, así que una prueba no puede tocar la base de desarrollo.
