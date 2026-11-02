// `npm run taller`: levanta el agente USB y la app, y abre el navegador (plan §3.1).
// Si el código cambió desde la última compilación, compila antes de arrancar.
import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = join(import.meta.dirname, '..')
const PYTHON = process.env.AGENTE_PYTHON ?? 'C:\\afix-usb\\venv\\Scripts\\python.exe'
const PUERTO = process.env.PUERTO ?? '3000'
const URL_APP = `http://127.0.0.1:${PUERTO}`

function versionActual() {
  try {
    const cabeza = execSync('git rev-parse HEAD', { cwd: raiz }).toString().trim()
    const cambios = execSync('git status --porcelain -- src supabase package.json next.config.ts', { cwd: raiz }).toString()
    return cambios ? `${cabeza}+${Buffer.from(cambios).toString('base64').length}` : cabeza
  } catch {
    return 'sin-git'
  }
}

function abrirNavegador() {
  spawn('cmd', ['/c', 'start', '', URL_APP], { detached: true, stdio: 'ignore' }).unref()
}

async function responde(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1500) })).ok
  } catch {
    return false
  }
}

// Doble clic con AFix ya abierto: no se levanta otra copia, solo se abre el navegador.
if (await responde(URL_APP)) {
  console.log(`AFix ya está corriendo en ${URL_APP}: se abre el navegador.`)
  abrirNavegador()
  process.exit(0)
}

const marca = join(raiz, '.next', 'afix-version')
const version = versionActual()
if (!existsSync(join(raiz, '.next', 'BUILD_ID')) || !existsSync(marca) || readFileSync(marca, 'utf8') !== version) {
  console.log('Compilando la app (solo la primera vez o después de una actualización)…')
  execSync('npx next build', { cwd: raiz, stdio: 'inherit' })
  writeFileSync(marca, version)
}

const procesos = []

if (await responde('http://127.0.0.1:8765/salud')) {
  console.log('El agente USB ya estaba corriendo.')
} else if (existsSync(PYTHON)) {
  procesos.push(
    spawn(PYTHON, ['-m', 'afix_usb.servidor'], { cwd: join(raiz, 'agente'), stdio: 'inherit' }),
  )
  console.log('Agente USB en http://127.0.0.1:8765')
} else {
  console.log(`No está el Python del agente en ${PYTHON}: la app abre en modo manual (sin USB).`)
}

procesos.push(spawn('npx', ['next', 'start', '-H', '127.0.0.1', '-p', PUERTO], { cwd: raiz, stdio: 'inherit', shell: true }))

setTimeout(abrirNavegador, 2500)
console.log('AFix abierto. Para cerrarlo, cierra esta ventana.')

function cerrar() {
  for (const p of procesos) p.kill()
  process.exit(0)
}
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
