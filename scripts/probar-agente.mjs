// `npm run test:agente`: corre las pruebas del agente USB con el Python de su venv.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const PYTHON = process.env.AGENTE_PYTHON ?? 'C:\\afix-usb\\venv\\Scripts\\python.exe'
const resultado = spawnSync(PYTHON, ['-m', 'pytest', '-q'], {
  cwd: join(import.meta.dirname, '..', 'agente'),
  stdio: 'inherit',
})
process.exit(resultado.status ?? 1)
