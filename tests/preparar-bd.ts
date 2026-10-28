import { execSync } from 'node:child_process'
import postgres from 'postgres'

// Crea desde cero la base de pruebas y le aplica las migraciones con el CLI de Supabase.
export default async function preparar() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('Falta TEST_DATABASE_URL (ver .env.example).')
  const destino = new URL(url)
  const nombre = destino.pathname.slice(1)
  if (!nombre.endsWith('_test')) throw new Error(`La base de pruebas debe terminar en _test, no "${nombre}".`)
  if (url === process.env.DATABASE_URL_DESARROLLO) throw new Error('TEST_DATABASE_URL no puede ser la base de desarrollo.')

  const admin = new URL(url)
  admin.pathname = '/postgres'
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} })
  try {
    await sql.unsafe(`drop database if exists "${nombre}" with (force)`)
    await sql.unsafe(`create database "${nombre}"`)
  } finally {
    await sql.end()
  }
  execSync(`supabase migration up --db-url "${url}"`, { stdio: 'pipe' })
}
