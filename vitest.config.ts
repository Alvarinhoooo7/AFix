import { config } from 'dotenv'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

config({ path: '.env.local', quiet: true })

const prueba = process.env.TEST_DATABASE_URL
const desarrollo = process.env.DATABASE_URL
if (!prueba) throw new Error('Falta TEST_DATABASE_URL (ver .env.example).')
if (prueba === desarrollo) throw new Error('TEST_DATABASE_URL no puede ser igual a DATABASE_URL.')

// Las pruebas reciben la base de pruebas como DATABASE_URL: obtenerDb() nunca ve la de desarrollo.
process.env.DATABASE_URL_DESARROLLO = desarrollo ?? ''
process.env.DATABASE_URL = prueba

export default defineConfig({
  resolve: { alias: { '@': resolve(process.cwd(), 'src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    globalSetup: ['tests/preparar-bd.ts'],
  },
})
