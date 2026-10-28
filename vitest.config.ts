import { config } from 'dotenv'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

config({ path: '.env.local', quiet: true })

export default defineConfig({
  resolve: { alias: { '@': resolve(process.cwd(), 'src') } },
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
  },
})
