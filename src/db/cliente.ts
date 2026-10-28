import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as esquema from './esquema'

export type DrizzleDb = ReturnType<typeof drizzle<typeof esquema>>

let instancia: DrizzleDb | undefined

export function obtenerDb(): DrizzleDb {
  if (!instancia) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('Falta la variable DATABASE_URL (revisa .env.local).')
    instancia = drizzle(postgres(url), { schema: esquema })
  }
  return instancia
}
