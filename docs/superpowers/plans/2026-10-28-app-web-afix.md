# App web AFIX — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La app web de servicio técnico de AFIX: registro de fichas por trabajo, checklist de ingreso y salida, historial por equipo, voucher imprimible y respaldo durable — funcionando de punta a punta con carga manual de datos, sin depender de la lectura por USB.

**Architecture:** Next.js (App Router) con TypeScript corriendo en `localhost`. Postgres en Supabase: las migraciones son archivos SQL versionados que maneja el CLI de Supabase, y Drizzle se usa **solo como constructor de consultas tipado** sobre un esquema escrito a mano que espeja ese SQL. La lógica de dominio (estados de ficha, vinculación de equipos, catálogo de checklist, comparación de batería) vive en funciones puras en `src/dominio/`, separadas del acceso a datos en `src/datos/`, para que se prueben sin base. Las pruebas de datos corren contra el Postgres local que levanta `supabase start` en Docker.

**Tech Stack:** Next.js, TypeScript, Drizzle ORM (solo consultas), Supabase CLI 2.98.2 + Docker 29.8.1 para Postgres, Vitest, hoja de estilos de impresión nativa del navegador (sin librería de PDF), GitHub Actions para el keepalive.

**Spec:** `docs/superpowers/specs/2026-10-28-plataforma-servicio-tecnico-design.md`

**Plan hermano:** el servicio de lectura USB en Python/FastAPI tiene su propio plan, posterior a este. Esta app se construye entera sin él: todos los campos del equipo se cargan a mano. El plan del USB solo agrega autocompletado.

## Global Constraints

- **Todo el texto visible en español chileno neutro.** Ninguna cadena en inglés, incluidos estados, botones, placeholders y mensajes de error. Nada de voseo rioplatense: "cargas"/"puedes", no "cargás"/"podés".
- **Paleta exacta, como tokens CSS:** fondo `#E8EDE9`, fondo de campo `#DCE4DE`, línea y texto base `#1F2A24`, tinta de valores `#16314A`, timbre/falla/alerta `#A8322B`, texto secundario `#5E6B64`. Un solo color de señal: el rojo del timbre.
- **Tipografía:** `Archivo Narrow` para etiquetas de campo y el timbre; `Archivo` para valores y texto corrido. Nada más.
- **Tics prohibidos** (son deuda conocida de los mockups): etiquetas en MAYÚSCULAS, cadenas unidas con puntos medios (`A · B · C`), flechas en el texto de los botones. Etiquetas en caja de oración; los botones dicen qué hacen.
- **Los campos son etiqueta chica sobre línea inferior**, como formulario preimpreso. No cajas con borde completo.
- **La ausencia de datos nunca bloquea.** Se puede guardar un ingreso sin IMEI, sin modelo y con todo el checklist en "No probado".
- **Migraciones solo por CLI de Supabase**, SQL en `supabase/migrations/`. Drizzle no genera ni aplica migraciones.
- **No se usan Auth, Storage ni Realtime de Supabase.** Es Postgres y nada más.
- **El servidor escucha solo en `localhost`.** No se expone a la red local. No hay login.
- **Piso de calidad:** responsive hasta ancho de teléfono, foco visible con teclado, `prefers-reduced-motion` respetado.
- **Commits frecuentes**, uno por tarea como mínimo.
- **Las claves del catálogo de checklist son canónicas.** Quedaron fijadas por la Tarea 2 y las fichas las graban, así que renombrar una exige migrar datos. Toda tarea que toque checklists usa exactamente estas:
  - `funcionamiento`, estados `["Bien","Falla","No probado"]`: `pantalla_tactil`, `true_tone`, `face_id`, `camara_trasera`, `camara_frontal`, `parlante`, `auricular`, `microfonos`, `carga`, `botones`, `vibrador`, `wifi_senal`, `sensor_proximidad`
  - `condicion`: `apertura_previa` `["Sin señales","Con señales"]`, `indicador_humedad` `["Sin indicio","Activado"]`, `vidrio_trasero` `["Sano","Rayado","Trizado"]`, `chasis` `["Sano","Golpes","Doblado"]`
  - Las claves son ASCII sin acentos a propósito; las etiquetas visibles sí los llevan (`Pantalla y táctil`, `Cámara trasera`, `Micrófonos`, `Wi-Fi y señal`, `Sensor de proximidad`).

## Review Focus

Clases de entrada que el diseño implica y que ninguna prueba del camino feliz toca. Cada línea tiene su prueba asignada a la tarea dueña del código.

1. **Equipo que llega apagado:** todo el checklist queda en "No probado" y la ficha se guarda igual. El diseño es explícito: eso es información, no un formulario incompleto. No debe haber validación que exija estados. → Tarea 8.
2. **Dos equipos distintos sin IMEI, ingresados el mismo día:** tienen que quedar como dos equipos separados. Un `UNIQUE` mal puesto sobre una columna nullable, o una búsqueda que trate `NULL` como valor, los fusiona y rompe el historial por equipo, que es el valor central. → Tarea 3.
3. **Un IMEI que aparece tarde y ya pertenece a otro equipo con ficha abierta:** vincular a ciegas mezcla dos historiales reales. Tiene que detectar el conflicto y no fusionar solo. → Tarea 3.
4. **Petición directa al servidor para editar una ficha congelada:** esconder el botón no alcanza. El rechazo va en la capa de datos, porque de eso depende que el voucher sirva como prueba. → Tarea 11.
5. **Base inalcanzable (sin internet, proyecto pausado):** mensaje claro en español, nunca una pantalla blanca ni un stacktrace, y lo que el dueño ya escribió en el formulario no se pierde. → Tarea 7.

---

## Estructura de archivos

```
supabase/
  config.toml                        supabase init
  migrations/
    0001_esquema_inicial.sql         equipo, ficha, ajustes_taller (Tarea 1)
    0003_cerrar_api_publica.sql      RLS y revokes (Tarea 1, ronda de arreglo)
    0004_catalogo_checklist.sql      catalogo_checklist + semilla v1 (Tarea 2)
    0005_notas_posteriores.sql       notas sobre fichas congeladas (Tarea 4)
    0006_modelos_iphone.sql          ProductType -> modelo comercial (Tarea 5)
    0007_indices_busqueda.sql        índices del buscador (Tarea 12)
    # Las migraciones se numeran en ORDEN DE CREACIÓN, no por número de tarea.
    # Cada tarea toma el siguiente número libre. Nunca insertes una migración
    # con número menor al de la última ya aplicada: el CLI la rechaza o la saltea.
src/
  db/
    cliente.ts                       conexión Postgres, una por proceso
    esquema.ts                       esquema Drizzle que espeja el SQL
  dominio/                           funciones puras, sin base
    checklist.ts                     tipos del catálogo, validación de estados
    equipo.ts                        normalización de IMEI, decisión de vinculación
    ficha.ts                         estados, transiciones, congelado, correlativo
    modelos-iphone.ts                ProductType -> modelo comercial
    bateria.ts                       comparación ingreso/salida
    respaldo.ts                      armado del archivo de respaldo
  datos/                             repositorios, único lugar que toca la base
    equipos.ts
    fichas.ts
    ajustes.ts
    catalogo.ts
  app/
    layout.tsx
    page.tsx                         inicio: equipos en taller, últimas fichas, buscador
    ingreso/page.tsx
    fichas/[numero]/page.tsx         ficha: reparación y salida
    fichas/[numero]/voucher/page.tsx
    ajustes/page.tsx
    api/respaldo/route.ts
  componentes/
    campo.tsx                        etiqueta sobre línea
    timbre.tsx                       número de ficha
    checklist.tsx                    líneas con estados y nota
    aviso-equipo-conocido.tsx        franja ámbar del ingreso
  estilos/
    tokens.css
    impresion.css
.github/workflows/keepalive.yml
tests/
  ayudas.ts                          ingresoVacio(), ingresoMinimo(), baseCaida()
  dominio/*.test.ts                  sin base
  datos/*.test.ts                    contra supabase start
```

`tests/ayudas.ts` se crea en la **Tarea 4**, que es donde se define `DatosIngreso`, y crece con las tareas siguientes. Las Tareas 1 a 3 no lo necesitan: insertan filas directamente con Drizzle, porque sus tablas existen desde la Tarea 1 y `crearFicha` todavía no. `ingresoVacio()` devuelve un `DatosIngreso` con todo en `null` o vacío y `origenDatos: 'manual'` — es el equipo apagado, el caso que más importa que funcione. `baseCaida()` es una base que rechaza toda consulta, para la prueba de la línea 5 de Review Focus.

---

### Task 1: Repositorio, Postgres local y esquema inicial

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`
- Create: `supabase/migrations/0001_esquema_inicial.sql`
- Create: `src/db/esquema.ts`, `src/db/cliente.ts`
- Test: `tests/datos/esquema.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `obtenerDb(): DrizzleDb` desde `src/db/cliente.ts`. Tablas Drizzle exportadas desde `src/db/esquema.ts`: `equipo`, `ficha`, `ajustesTaller`.

Tablas según §7 del diseño. `equipo` lleva **clave interna propia** (`id uuid default gen_random_uuid()`) y `imei text` **nullable** con **índice único parcial** (`create unique index … on equipo (imei) where imei is not null`) — un `UNIQUE` normal también permitiría múltiples `NULL` en Postgres, pero el índice parcial declara la intención y es lo que la prueba fija. `ficha.estado` es un enum Postgres con `en_taller`, `entregado`, `entregado_sin_reparar`. `ajustes_taller` tiene una sola fila, forzada por `check (id = 1)`, y **la migración la siembra** con `nombre = 'AFIX'` y el resto en `null`. La Tarea 6 declara que `leerAjustes` nunca devuelve vacío, y eso solo es cierto si la fila existe desde el principio.

- [ ] **Step 1: Inicializar el repositorio y las herramientas**

`git init`, Next.js con TypeScript y App Router, Vitest, Drizzle, `supabase init`. Agregar `.superpowers/` y `.env*` al `.gitignore`.

Los scripts de `package.json` **fijan el host**: `next dev -H 127.0.0.1` y `next start -H 127.0.0.1`. Hace falta decirlo explícitamente porque `next start` escucha en todas las interfaces por omisión, y Global Constraints exige solo `localhost` — sin login, exponerlo a la red Wi-Fi publicaría el historial.

- [ ] **Step 2: Levantar Postgres local**

Run: `supabase start`
Expected: imprime la `DB URL` local. Guardarla en `.env.local` como `DATABASE_URL`.

- [ ] **Step 3: Escribir la prueba que falla**

```ts
// tests/datos/esquema.test.ts
test('un equipo se puede crear sin IMEI', async () => {
  const [e] = await obtenerDb().insert(equipo).values({ modeloComercial: 'iPhone 11' }).returning()
  expect(e.id).toBeTruthy()
  expect(e.imei).toBeNull()
})

test('dos equipos sin IMEI conviven como registros separados', async () => {
  const db = obtenerDb()
  const [a] = await db.insert(equipo).values({ modeloComercial: 'iPhone 11' }).returning()
  const [b] = await db.insert(equipo).values({ modeloComercial: 'iPhone 12' }).returning()
  expect(a.id).not.toBe(b.id)
})

test('dos equipos no pueden compartir el mismo IMEI', async () => {
  const db = obtenerDb()
  await db.insert(equipo).values({ imei: '358721094473321' })
  await expect(db.insert(equipo).values({ imei: '358721094473321' })).rejects.toThrow()
})

test('ajustes_taller admite una sola fila', async () => {
  await expect(obtenerDb().insert(ajustesTaller).values({ id: 2, nombre: 'Otro' })).rejects.toThrow()
})
```

- [ ] **Step 4: Correr las pruebas y verificar que fallan**

Run: `npx vitest run tests/datos/esquema.test.ts`
Expected: FAIL, las tablas no existen.

- [ ] **Step 5: Escribir `0001_esquema_inicial.sql` y aplicarlo**

Run: `supabase migration up`

- [ ] **Step 6: Escribir `src/db/esquema.ts` y `src/db/cliente.ts`**

El esquema Drizzle espeja el SQL; nombres de columna en `snake_case` en la base, propiedades en `camelCase` en TypeScript. `obtenerDb()` devuelve una única instancia por proceso.

- [ ] **Step 7: Correr las pruebas y verificar que pasan**

Run: `npx vitest run tests/datos/esquema.test.ts`
Expected: PASS, los 4 casos.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: esquema inicial y Postgres local"
```

---

### Task 2: Catálogo de checklist versionado

**Files:**
- Create: `supabase/migrations/0004_catalogo_checklist.sql`
- Create: `src/dominio/checklist.ts`, `src/datos/catalogo.ts`
- Test: `tests/dominio/checklist.test.ts`, `tests/datos/catalogo.test.ts`

**Interfaces:**
- Consumes: `obtenerDb`, tablas de la Tarea 1.
- Produces: `type LineaCatalogo = { clave: string; etiqueta: string; bloque: 'funcionamiento' | 'condicion'; orden: number; estados: string[] }`; `type Checklist = Record<string, { estado: string; nota?: string }>`; `catalogoActivo(): Promise<{ version: number; lineas: LineaCatalogo[] }>`; `catalogoPorVersion(v: number): Promise<{ version: number; lineas: LineaCatalogo[] }>`; `validarChecklist(c: Checklist, lineas: LineaCatalogo[]): string[]` (devuelve claves inválidas, vacío si está bien); `todosLosCatalogos(): Promise<{ version: number; lineas: LineaCatalogo[] }[]>` — lo necesita la Tarea 14, porque un respaldo sin todas las versiones del catálogo no permite volver a leer una ficha vieja.

La semilla es la versión 1, con las 17 líneas de §9.4 del diseño: 13 de **funcionamiento** con estados `Bien` / `Falla` / `No probado` — pantalla y táctil, True Tone, Face ID, cámara trasera, cámara frontal, parlante, auricular, micrófonos, carga, botones, vibrador, Wi-Fi y señal, sensor de proximidad — y 4 de **condición** con sus propios estados: apertura previa (`Sin señales` / `Con señales`), indicador de humedad (`Sin indicio` / `Activado`), vidrio trasero (`Sano` / `Rayado` / `Trizado`), chasis (`Sano` / `Golpes` / `Doblado`).

Las líneas son datos, nunca código. La ficha guarda el número de versión que usó, y una ficha vieja se muestra con sus líneas de entonces (requisito de §9.4).

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/datos/catalogo.test.ts
test('la versión activa trae las 17 líneas del diseño', async () => {
  const { version, lineas } = await catalogoActivo()
  expect(version).toBe(1)
  expect(lineas.filter(l => l.bloque === 'funcionamiento')).toHaveLength(13)
  expect(lineas.filter(l => l.bloque === 'condicion')).toHaveLength(4)
})

test('las líneas de funcionamiento tienen los tres estados', async () => {
  const { lineas } = await catalogoActivo()
  const faceId = lineas.find(l => l.clave === 'face_id')!
  expect(faceId.estados).toEqual(['Bien', 'Falla', 'No probado'])
})

test('cada línea de condición tiene sus propios estados', async () => {
  const { lineas } = await catalogoActivo()
  expect(lineas.find(l => l.clave === 'apertura_previa')!.estados).toEqual(['Sin señales', 'Con señales'])
  expect(lineas.find(l => l.clave === 'vidrio_trasero')!.estados).toEqual(['Sano', 'Rayado', 'Trizado'])
})

// tests/dominio/checklist.test.ts
test('validarChecklist rechaza un estado que no existe en la línea', () => {
  const lineas = [{ clave: 'face_id', etiqueta: 'Face ID', bloque: 'funcionamiento', orden: 1, estados: ['Bien', 'Falla', 'No probado'] }]
  expect(validarChecklist({ face_id: { estado: 'Rayado' } }, lineas)).toEqual(['face_id'])
})

test('validarChecklist acepta un checklist vacío', () => {
  expect(validarChecklist({}, [])).toEqual([])
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/dominio/checklist.test.ts tests/datos/catalogo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `0004_catalogo_checklist.sql` con la semilla y aplicarlo**

Run: `supabase migration up`

- [ ] **Step 4: Implementar `src/dominio/checklist.ts` y `src/datos/catalogo.ts`**

- [ ] **Step 5: Correr y verificar que pasan**

Run: `npx vitest run tests/dominio/checklist.test.ts tests/datos/catalogo.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: catalogo de checklist versionado"
```

---

### Task 3: Dominio de equipo — IMEI y vinculación

**Files:**
- Create: `src/dominio/equipo.ts`, `src/datos/equipos.ts`
- Test: `tests/dominio/equipo.test.ts`, `tests/datos/equipos.test.ts`

**Interfaces:**
- Consumes: Tarea 1.
- Produces: `normalizarImei(bruto: string): string | null`; `type DecisionVinculacion = { tipo: 'asignar' } | { tipo: 'fusionar'; equipoDestinoId: string } | { tipo: 'conflicto'; equipoDestinoId: string; motivo: string }`; `decidirVinculacion(equipoActual, equipoConEseImei): DecisionVinculacion`; `buscarPorImei(imei: string): Promise<Equipo | null>`; `fusionarEquipos(origenId: string, destinoId: string): Promise<void>`; `obtenerEquipo(id: string): Promise<Equipo | null>`; `fichasDeEquipo(equipoId: string): Promise<Ficha[]>`.

Esta tarea cubre dos de las líneas de Review Focus. `normalizarImei` quita espacios y guiones y devuelve `null` para lo que no sea 15 dígitos, así que basura escrita a mano nunca se guarda como identidad. `decidirVinculacion` **no fusiona sola** cuando el equipo destino tiene una ficha abierta: devuelve `conflicto` y la decisión sube a la interfaz.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/dominio/equipo.test.ts
test('normalizarImei limpia separadores', () => {
  expect(normalizarImei(' 35 872109-447 3321 ')).toBe('358721094473321')
})

test('normalizarImei devuelve null si no son 15 dígitos', () => {
  expect(normalizarImei('12345')).toBeNull()
  expect(normalizarImei('no se ve')).toBeNull()
})

test('un IMEI nuevo se asigna al equipo actual', () => {
  expect(decidirVinculacion({ id: 'a' }, null)).toEqual({ tipo: 'asignar' })
})

test('un IMEI que ya existe sin ficha abierta propone fusionar', () => {
  const d = decidirVinculacion({ id: 'a' }, { id: 'b', tieneFichaAbierta: false })
  expect(d).toEqual({ tipo: 'fusionar', equipoDestinoId: 'b' })
})

test('un IMEI que ya existe con ficha abierta es conflicto, no fusión', () => {
  const d = decidirVinculacion({ id: 'a' }, { id: 'b', tieneFichaAbierta: true })
  expect(d.tipo).toBe('conflicto')
})

// tests/datos/equipos.test.ts
test('buscarPorImei no confunde dos equipos sin IMEI', async () => {
  const db = obtenerDb()
  await db.insert(equipo).values([{ modeloComercial: 'iPhone 11' }, { modeloComercial: 'iPhone 12' }])
  expect(await buscarPorImei('')).toBeNull()
  expect(await buscarPorImei('358721094473321')).toBeNull()
})

test('fusionar mueve las fichas al equipo destino y borra el origen', async () => {
  // crea equipo origen con 1 ficha, equipo destino con 1 ficha, fusiona
  await fusionarEquipos(origenId, destinoId)
  expect(await fichasDeEquipo(destinoId)).toHaveLength(2)
  expect(await obtenerEquipo(origenId)).toBeNull()
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/dominio/equipo.test.ts tests/datos/equipos.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `src/dominio/equipo.ts` y `src/datos/equipos.ts`**

`fusionarEquipos` corre en una transacción: reasigna `ficha.equipo_id`, copia al destino los campos de identidad que estén vacíos, borra el origen.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/dominio/equipo.test.ts tests/datos/equipos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: identidad de equipo y vinculacion por IMEI"
```

---

### Task 4: Dominio de ficha — estados, correlativo y congelado

**Files:**
- Create: `src/dominio/ficha.ts`, `src/datos/fichas.ts`
- Test: `tests/dominio/ficha.test.ts`, `tests/datos/fichas.test.ts`

**Interfaces:**
- Consumes: Tareas 1 y 3.
- Produces: `type EstadoFicha = 'en_taller' | 'entregado' | 'entregado_sin_reparar'`; `transicionPermitida(desde: EstadoFicha, hacia: EstadoFicha): boolean`; `estaCongelada(f: Ficha): boolean`; `crearFicha(datos: DatosIngreso): Promise<Ficha>`; `actualizarFicha(numero: number, cambios: Partial<Ficha>): Promise<Ficha>` (lanza si está congelada); `agregarNotaPosterior(numero: number, texto: string): Promise<void>`; `cerrarFicha(numero: number, estado: 'entregado' | 'entregado_sin_reparar'): Promise<Ficha>`; `obtenerFicha(numero: number): Promise<Ficha | null>`.
- Produces el tipo de entrada que usan las Tareas 7 y 8:

```ts
type DatosIngreso = {
  imei: string | null; numeroSerie: string | null
  modeloProducto: string | null; modeloComercial: string; capacidad: string | null
  iosVersion: string | null; bateriaPct: number | null; bateriaCiclos: number | null
  pidioCliente: string; quienLoTrajo: string | null; telefono: string | null
  observacionIngreso: string
  checklistIngreso: Checklist          // Tarea 2
  catalogoVersion: number              // Tarea 2
  origenDatos: 'usb' | 'manual' | 'mixto'
}
```

Reglas de §7.5: `en_taller` es editable; cerrar sella la ficha y escribe `congelada_en`; después solo se pueden agregar notas con fecha, que nunca pisan lo original. El correlativo lo da una secuencia Postgres, así que no se repite ni depende de contar filas.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/dominio/ficha.test.ts
test('solo se puede cerrar desde en_taller', () => {
  expect(transicionPermitida('en_taller', 'entregado')).toBe(true)
  expect(transicionPermitida('en_taller', 'entregado_sin_reparar')).toBe(true)
  expect(transicionPermitida('entregado', 'en_taller')).toBe(false)
  expect(transicionPermitida('entregado', 'entregado_sin_reparar')).toBe(false)
})

// tests/datos/fichas.test.ts
test('el correlativo avanza y no se repite', async () => {
  const a = await crearFicha(ingresoMinimo())
  const b = await crearFicha(ingresoMinimo())
  expect(b.numero).toBe(a.numero + 1)
})

test('una ficha en taller se puede editar', async () => {
  const f = await crearFicha(ingresoMinimo())
  const g = await actualizarFicha(f.numero, { observacionIngreso: 'corregido' })
  expect(g.observacionIngreso).toBe('corregido')
})

test('cerrar escribe congelada_en', async () => {
  const f = await cerrarFicha((await crearFicha(ingresoMinimo())).numero, 'entregado')
  expect(f.congeladaEn).toBeTruthy()
})

test('actualizarFicha rechaza una ficha ya congelada', async () => {
  const f = await crearFicha(ingresoMinimo())
  await cerrarFicha(f.numero, 'entregado')
  await expect(actualizarFicha(f.numero, { observacionIngreso: 'otra' })).rejects.toThrow(/congelada/i)
})

test('se puede entregar sin reparar', async () => {
  const f = await cerrarFicha((await crearFicha(ingresoMinimo())).numero, 'entregado_sin_reparar')
  expect(f.estado).toBe('entregado_sin_reparar')
})

test('una nota posterior no pisa la observación original', async () => {
  const f = await crearFicha(ingresoMinimo({ observacionIngreso: 'original' }))
  await cerrarFicha(f.numero, 'entregado')
  await agregarNotaPosterior(f.numero, 'apareció otra cosa')
  const g = await obtenerFicha(f.numero)
  expect(g.observacionIngreso).toBe('original')
  expect(g.notasPosteriores[0].texto).toBe('apareció otra cosa')
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/dominio/ficha.test.ts tests/datos/fichas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Agregar `nota_posterior` al esquema**

Migración `0005_notas_posteriores.sql`: tabla con `ficha_numero`, `texto`, `creada_en`. Aplicar con `supabase migration up`.

- [ ] **Step 4: Implementar `src/dominio/ficha.ts` y `src/datos/fichas.ts`**

- [ ] **Step 5: Correr y verificar que pasan**

Run: `npx vitest run tests/dominio/ficha.test.ts tests/datos/fichas.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: estados de ficha, correlativo y congelado"
```

---

### Task 5: ProductType a modelo comercial

**Files:**
- Create: `supabase/migrations/0006_modelos_iphone.sql`, `src/dominio/modelos-iphone.ts`
- Test: `tests/dominio/modelos-iphone.test.ts`

**Interfaces:**
- Consumes: Tarea 1.
- Produces: `type Resolucion = { modeloComercial: string; requiereConfirmacion: boolean }`; `resolverModelo(productType: string | null, tabla: Map<string, string>): Resolucion`; `cargarTablaModelos(): Promise<Map<string, string>>` en `src/datos/modelos.ts` — `resolverModelo` es pura a propósito, pero alguien tiene que leer la tabla sembrada, y es esto.

La semilla cubre de iPhone 8 en adelante, que es el rango que el dueño atiende. Requisito de §8.2: un `ProductType` desconocido **no falla** — devuelve el código crudo con `requiereConfirmacion: true`, y la interfaz deja escribir el nombre a mano.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
test('un ProductType conocido resuelve al nombre comercial', () => {
  expect(resolverModelo('iPhone13,2', tabla)).toEqual({ modeloComercial: 'iPhone 12', requiereConfirmacion: false })
})

test('un ProductType desconocido devuelve el código crudo y pide confirmación', () => {
  expect(resolverModelo('iPhone99,1', tabla)).toEqual({ modeloComercial: 'iPhone99,1', requiereConfirmacion: true })
})

test('sin ProductType pide confirmación y no inventa modelo', () => {
  expect(resolverModelo(null, tabla)).toEqual({ modeloComercial: '', requiereConfirmacion: true })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/dominio/modelos-iphone.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir la migración con la semilla e implementar `resolverModelo`**

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/dominio/modelos-iphone.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: equivalencia ProductType a modelo comercial"
```

---

### Task 6: Sistema visual y pantalla de ajustes del taller

**Files:**
- Create: `src/estilos/tokens.css`, `src/app/layout.tsx`, `src/componentes/campo.tsx`, `src/componentes/timbre.tsx`
- Create: `src/app/ajustes/page.tsx`, `src/datos/ajustes.ts`
- Test: `tests/datos/ajustes.test.ts`

**Interfaces:**
- Consumes: Tarea 1.
- Produces: tokens CSS con los 6 colores de Global Constraints; `<Campo etiqueta="..." valor={...} editable />`; `<Timbre numero={52} />`; `leerAjustes(): Promise<AjustesTaller>`; `guardarAjustes(a: AjustesTaller): Promise<void>`.

Es la pantalla más chica, así que es donde se funda el sistema visual de §10: tokens, las dos fuentes Archivo, el campo como etiqueta sobre línea y el timbre de goma. Todo lo demás se construye encima. Carga nombre (`AFIX`), teléfono, dirección y la ruta del logo, una sola vez.

El logo es un archivo estático en `public/` cuya ruta se guarda en los ajustes; **no hay subida de imágenes** (§9.6). Mientras no exista, todo renderiza con el nombre en texto.

- [ ] **Step 1: Escribir la prueba que falla**

```ts
test('los ajustes arrancan con AFIX y sin logo', async () => {
  const a = await leerAjustes()
  expect(a.nombre).toBe('AFIX')
  expect(a.rutaLogo).toBeNull()
})

test('guardar y volver a leer conserva los datos', async () => {
  await guardarAjustes({ nombre: 'AFIX', telefono: '+56 9 1234 5678', direccion: 'Taller 1', rutaLogo: null })
  expect((await leerAjustes()).telefono).toBe('+56 9 1234 5678')
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/datos/ajustes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Escribir `tokens.css`, `layout.tsx`, `Campo` y `Timbre`**

Los 6 colores como variables CSS en `:root`. `Archivo` y `Archivo Narrow` desde Google Fonts. `Campo` es etiqueta chica en `Archivo Narrow` sobre línea inferior de 1px, valor en `Archivo` semibold color tinta. `Timbre` es caja de borde 2.5px en el rojo del timbre, rotada `-3.5deg`.

- [ ] **Step 4: Implementar `src/datos/ajustes.ts` y la pantalla de ajustes**

La fila de ajustes se crea con `AFIX` como nombre en la migración `0001`, así que `leerAjustes` nunca devuelve vacío.

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/datos/ajustes.test.ts`
Expected: PASS.

- [ ] **Step 6: Verificar a ojo en el navegador**

Run: `npm run dev` y abrir `/ajustes`
Expected: fondo `#E8EDE9`, campos como formulario preimpreso, nada en MAYÚSCULAS, foco visible al tabular.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: sistema visual y ajustes del taller"
```

---

### Task 7: Ingreso manual

**Files:**
- Create: `src/app/ingreso/page.tsx`
- Modify: `src/datos/fichas.ts`
- Test: `tests/datos/ingreso.test.ts`

**Interfaces:**
- Consumes: Tareas 3, 4, 5, 6. El tipo `DatosIngreso` y `crearFicha` vienen de la Tarea 4.
- Produces: `intentarGuardarIngreso(datos: DatosIngreso, deps: { db: DrizzleDb }): Promise<{ ok: true; ficha: Ficha } | { ok: false; mensaje: string; datos: DatosIngreso }>`.

Todos los campos del equipo se cargan a mano; `origenDatos` queda en `manual`. El plan del servicio USB solo agrega el autocompletado encima de esta pantalla, sin cambiarla.

Cubre la línea 5 de Review Focus: si la base no responde, la pantalla muestra un mensaje en español y **lo escrito en el formulario no se pierde**.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('se guarda un ingreso sin IMEI ni modelo', async () => {
  const f = await crearFicha({ ...ingresoVacio(), pidioCliente: 'Cambiar la batería' })
  expect(f.numero).toBeGreaterThan(0)
  expect(f.estado).toBe('en_taller')
})

test('un ingreso con IMEI crea el equipo con ese IMEI', async () => {
  const f = await crearFicha({ ...ingresoVacio(), imei: '358721094473321' })
  expect((await obtenerEquipo(f.equipoId)).imei).toBe('358721094473321')
})

test('un IMEI mal escrito no se guarda como identidad', async () => {
  const f = await crearFicha({ ...ingresoVacio(), imei: '123' })
  expect((await obtenerEquipo(f.equipoId)).imei).toBeNull()
})

test('si la base no responde, el error es en español y trae lo escrito', async () => {
  const resultado = await intentarGuardarIngreso(datos, { db: baseCaida() })
  expect(resultado.ok).toBe(false)
  expect(resultado.mensaje).toMatch(/no se pudo guardar/i)
  expect(resultado.datos).toEqual(datos)
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/datos/ingreso.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar la pantalla de ingreso y `intentarGuardarIngreso`**

`intentarGuardarIngreso(datos, deps): Promise<{ ok: true; ficha: Ficha } | { ok: false; mensaje: string; datos: DatosIngreso }>`. Nunca lanza hacia la interfaz: devuelve el fallo con los datos adentro para volver a pintar el formulario.

Franja superior con **Reintentar** y **Cargar a mano**, según §8.4. En este plan el estado inicial es "cargar a mano", porque todavía no hay servicio USB.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/datos/ingreso.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: ingreso manual de equipos"
```

---

### Task 8: Checklist de ingreso con notas

**Files:**
- Create: `src/componentes/checklist.tsx`
- Modify: `src/app/ingreso/page.tsx`, `src/datos/fichas.ts`
- Test: `tests/datos/checklist-ficha.test.ts`

**Interfaces:**
- Consumes: Tareas 2, 7.
- Produces: `<Checklist lineas={...} valor={...} onChange={...} />`; la ficha guarda `checklistIngreso: Checklist` y `catalogoVersion: number`.

Cubre la línea 1 de Review Focus, que es la más importante de todas: **un equipo apagado se guarda con todo en "No probado" y eso no es un formulario incompleto.** No debe existir validación que exija estados.

Cada línea tiene su nota opcional detrás del `✎`. Las notas vacías no se guardan.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('un equipo apagado se guarda con todo en No probado', async () => {
  const { lineas } = await catalogoActivo()
  const todoSinProbar = Object.fromEntries(
    lineas.filter(l => l.bloque === 'funcionamiento').map(l => [l.clave, { estado: 'No probado' }])
  )
  const f = await crearFicha({ ...ingresoVacio(), checklistIngreso: todoSinProbar })
  expect(f.numero).toBeGreaterThan(0)
})

test('se guarda una ficha con el checklist completamente vacío', async () => {
  const f = await crearFicha({ ...ingresoVacio(), checklistIngreso: {} })
  expect(f.checklistIngreso).toEqual({})
})

test('las notas escritas se guardan y las vacías no', async () => {
  const f = await crearFicha({ ...ingresoVacio(), checklistIngreso: {
    face_id: { estado: 'Falla', nota: 'Ya venía así' },
    carga: { estado: 'Bien', nota: '' },
  }})
  expect(f.checklistIngreso.face_id.nota).toBe('Ya venía así')
  expect(f.checklistIngreso.carga.nota).toBeUndefined()
})

test('la ficha registra la versión del catálogo que usó', async () => {
  const f = await crearFicha(ingresoVacio())
  expect(f.catalogoVersion).toBe(1)
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/datos/checklist-ficha.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `<Checklist>` y la persistencia**

Los estados son botones en fila; el activo se pinta con el color de la línea (tinta para bien, rojo del timbre para falla y para los estados de alerta de condición). El `✎` abre la nota.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/datos/checklist-ficha.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: checklist de ingreso con notas por linea"
```

---

### Task 9: Aviso de equipo conocido

**Files:**
- Create: `src/componentes/aviso-equipo-conocido.tsx`
- Modify: `src/app/ingreso/page.tsx`, `src/datos/equipos.ts`
- Test: `tests/datos/equipo-conocido.test.ts`

**Interfaces:**
- Consumes: Tareas 3, 7.
- Produces: `historialDeImei(imei: string): Promise<{ numero: number; trabajos: string[]; entregadoEn: Date }[]>`.

Requisito de §9.1: es **aviso, no desvío**. No pregunta si quiere continuar, no bifurca el flujo, no impide crear la ficha nueva. Franja con el número de ficha anterior, qué se le hizo, cuándo, y un botón para abrirla.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('un IMEI con historia la devuelve, de la más nueva a la más vieja', async () => {
  const h = await historialDeImei('358721094473321')
  expect(h).toHaveLength(2)
  expect(h[0].numero).toBeGreaterThan(h[1].numero)
})

test('un IMEI sin historia devuelve lista vacía', async () => {
  expect(await historialDeImei('351190048827714')).toEqual([])
})

test('el aviso no impide crear la ficha nueva', async () => {
  const f = await crearFicha({ ...ingresoVacio(), imei: '358721094473321' })
  expect(f.numero).toBeGreaterThan(0)
  expect(await historialDeImei('358721094473321')).toHaveLength(3)
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/datos/equipo-conocido.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `historialDeImei` y la franja**

Franja en el rojo del timbre al 8 % de opacidad con borde izquierdo sólido, arriba de todo en el ingreso.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/datos/equipo-conocido.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: aviso de equipo que ya paso por el taller"
```

---

### Task 10: Reparación

**Files:**
- Create: `src/app/fichas/[numero]/page.tsx`
- Test: `tests/datos/reparacion.test.ts`

**Interfaces:**
- Consumes: Tareas 4, 6.
- Produces: `TRABAJOS: readonly string[]` en `src/dominio/ficha.ts`; la ficha guarda `trabajosRealizados: string[]` y `notaReparacion: string`.

Los 10 trabajos de §9.2 más "otro" con texto: batería, pantalla, parlante, auricular, cámara trasera, cámara frontal, puerto de carga, vibrador, botones, vidrio trasero.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('se guardan varios trabajos a la vez', async () => {
  const f = await crearFicha(ingresoVacio())
  const g = await actualizarFicha(f.numero, { trabajosRealizados: ['Batería', 'Parlante'] })
  expect(g.trabajosRealizados).toEqual(['Batería', 'Parlante'])
})

test('la nota de reparación se guarda', async () => {
  const f = await crearFicha(ingresoVacio())
  const g = await actualizarFicha(f.numero, { notaReparacion: 'El flex estaba pegado con exceso de adhesivo' })
  expect(g.notaReparacion).toContain('adhesivo')
})

test('se puede cerrar una ficha sin ningún trabajo registrado', async () => {
  const f = await crearFicha(ingresoVacio())
  const g = await cerrarFicha(f.numero, 'entregado_sin_reparar')
  expect(g.estado).toBe('entregado_sin_reparar')
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/datos/reparacion.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar la pantalla de ficha con el bloque de reparación**

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/datos/reparacion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: registro de trabajos realizados"
```

---

### Task 11: Salida, comparación de batería y congelado

**Files:**
- Create: `src/dominio/bateria.ts`
- Modify: `src/app/fichas/[numero]/page.tsx`, `src/datos/fichas.ts`
- Test: `tests/dominio/bateria.test.ts`, `tests/datos/salida.test.ts`

**Interfaces:**
- Consumes: Tareas 2, 4, 8, 10.
- Produces: `compararBateria(ingreso: { pct: number | null; ciclos: number | null }, salida: {...}): { pctDelta: number | null; ciclosDelta: number | null; comparable: boolean }`.

Cubre la línea 4 de Review Focus: **la capa de datos rechaza editar una ficha congelada**, no solo la interfaz. De eso depende que el voucher sirva como prueba.

`comparable` es `false` si falta cualquiera de los dos lados, y entonces el voucher no muestra la comparación en vez de mostrar un número inventado — lo que importa mientras §8.3 siga sin verificar.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
// tests/dominio/bateria.test.ts
test('compara porcentaje y ciclos', () => {
  const c = compararBateria({ pct: 79, ciclos: 743 }, { pct: 100, ciclos: 0 })
  expect(c).toEqual({ pctDelta: 21, ciclosDelta: -743, comparable: true })
})

test('sin datos de un lado no es comparable', () => {
  expect(compararBateria({ pct: null, ciclos: null }, { pct: 100, ciclos: 0 }).comparable).toBe(false)
})

// tests/datos/salida.test.ts
test('el checklist de salida usa las mismas líneas que el de ingreso', async () => {
  const f = await crearFicha(ingresoVacio())
  const g = await actualizarFicha(f.numero, { checklistSalida: { face_id: { estado: 'Bien' } } })
  expect(g.catalogoVersion).toBe(f.catalogoVersion)
})

test('editar una ficha congelada es rechazado por la capa de datos', async () => {
  const f = await crearFicha(ingresoVacio())
  await cerrarFicha(f.numero, 'entregado')
  await expect(actualizarFicha(f.numero, { observacionSalida: 'otra cosa' })).rejects.toThrow(/congelada/i)
})

test('cerrar dos veces la misma ficha es rechazado', async () => {
  const f = await crearFicha(ingresoVacio())
  await cerrarFicha(f.numero, 'entregado')
  await expect(cerrarFicha(f.numero, 'entregado')).rejects.toThrow()
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/dominio/bateria.test.ts tests/datos/salida.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `compararBateria` y el bloque de salida**

El rechazo de la ficha congelada va dentro de `actualizarFicha`, no en el componente.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/dominio/bateria.test.ts tests/datos/salida.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: salida, comparacion de bateria y congelado de ficha"
```

---

### Task 12: Inicio y buscador

**Files:**
- Create: `src/app/page.tsx`
- Modify: `src/datos/fichas.ts`
- Test: `tests/datos/busqueda.test.ts`

**Interfaces:**
- Consumes: Tareas 4, 6.
- Produces: `type FilaInicio = { numero: number; estado: EstadoFicha; modeloComercial: string; imei: string | null; quienLoTrajo: string | null; recibidoEn: Date; entregadoEn: Date | null; trabajos: string[] }`; `equiposEnTaller(): Promise<FilaInicio[]>`; `ultimasEntregadas(limite: number): Promise<FilaInicio[]>`; `buscar(texto: string): Promise<FilaInicio[]>`.

Según §9.5: equipos en taller arriba y destacados, últimas entregadas debajo, y un buscador que entra por número de ficha, IMEI, número de serie, modelo y **quién lo trajo**.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('los equipos en taller salen primero y no incluyen entregados', async () => {
  const filas = await equiposEnTaller()
  expect(filas.every(f => f.estado === 'en_taller')).toBe(true)
})

test('busca por número de ficha', async () => {
  expect((await buscar('52'))[0].numero).toBe(52)
})

test('busca por IMEI, serie y modelo', async () => {
  expect(await buscar('358721094473321')).toHaveLength(1)
  expect(await buscar('F2LXK9PQ0D4H')).toHaveLength(1)
  expect((await buscar('iPhone 12')).length).toBeGreaterThan(0)
})

test('busca por quién lo trajo, sin distinguir mayúsculas', async () => {
  expect((await buscar('marcela')).length).toBeGreaterThan(0)
})

test('una búsqueda sin resultados devuelve lista vacía, no error', async () => {
  expect(await buscar('nada de esto existe')).toEqual([])
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/datos/busqueda.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar las consultas y la pantalla de inicio**

Búsqueda insensible a mayúsculas y acentos. Agregar los índices que las consultas necesiten en `0007_indices_busqueda.sql`.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/datos/busqueda.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: pantalla de inicio y buscador"
```

---

### Task 13: Voucher imprimible

**Files:**
- Create: `src/app/fichas/[numero]/voucher/page.tsx`, `src/estilos/impresion.css`
- Test: `tests/dominio/voucher.test.ts`

**Interfaces:**
- Consumes: Tareas 2, 6, 11.
- Produces: `datosVoucher(numero: number): Promise<DatosVoucher>`.

Contenido exacto de §9.6. **Lleva:** datos de AFIX (nombre, teléfono, dirección, logo), número de ficha, fechas de ingreso y entrega, datos del equipo, **los dos checklists lado a lado**, antes y después de batería, trabajos realizados, y las observaciones generales de ingreso y salida.

**No lleva, porque el dueño no lo eligió:** texto de garantía, lo que pidió el cliente, y la nota de reparación. Las pruebas fijan las tres ausencias, porque son decisiones del dueño y es fácil agregarlas "por completitud" sin darse cuenta.

El voucher imprime bien **sin logo** mientras el archivo no exista, dejando el nombre AFIX en texto.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('el voucher trae los dos checklists con las líneas de su versión', async () => {
  const v = await datosVoucher(52)
  expect(v.lineas).toHaveLength(17)
  expect(v.checklistIngreso).toBeDefined()
  expect(v.checklistSalida).toBeDefined()
})

test('el voucher no expone la nota de reparación ni lo que pidió el cliente', async () => {
  const v = await datosVoucher(52)
  expect(v).not.toHaveProperty('notaReparacion')
  expect(v).not.toHaveProperty('pidioCliente')
  expect(v).not.toHaveProperty('garantia')
})

test('el voucher funciona sin logo cargado', async () => {
  await guardarAjustes({ nombre: 'AFIX', telefono: null, direccion: null, rutaLogo: null })
  const v = await datosVoucher(52)
  expect(v.taller.nombre).toBe('AFIX')
  expect(v.taller.rutaLogo).toBeNull()
})

test('una ficha entregada sin reparar no muestra comparación de batería inventada', async () => {
  const v = await datosVoucher(numeroSinReparar)
  expect(v.bateria.comparable).toBe(false)
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/dominio/voucher.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `datosVoucher`, la página y `impresion.css`**

`@media print`: sin fondos que gasten tinta salvo el rojo del timbre, sin cortar los checklists entre páginas (`break-inside: avoid`), tamaño carta.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/dominio/voucher.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar la impresión de verdad**

Abrir el voucher de una ficha cerrada y usar la vista previa de impresión del navegador.
Expected: entra en una hoja carta, los dos checklists quedan lado a lado y legibles, el timbre se ve.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: voucher imprimible"
```

---

### Task 14: Durabilidad — respaldo exportable y keepalive

**Files:**
- Create: `src/dominio/respaldo.ts`, `src/app/api/respaldo/route.ts`
- Create: `.github/workflows/keepalive.yml`
- Create: `README.md`
- Test: `tests/dominio/respaldo.test.ts`

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: `armarRespaldo(): Promise<Respaldo>` con `{ generadoEn, equipos, fichas, notasPosteriores, ajustes, catalogos }`.

Las dos medidas de §11.1, que son lo que hace que "sobrevive a la muerte del PC" sea verdad y no una intención:

- **Respaldo exportable:** un archivo JSON que el dueño baja y guarda donde quiera. Lleva **todas** las versiones del catálogo, no solo la activa, porque sin eso una ficha vieja no se puede volver a leer.
- **Keepalive:** cron de GitHub Actions, **no un proceso en el PC** — si latiera desde el PC dejaría de latir justo en el escenario del que protege. Una consulta trivial, bastante más seguida que el plazo de inactividad del plan gratuito. La credencial va en un secreto del repositorio.

El README documenta la puesta en marcha en una máquina nueva, que es el escenario de recuperación entero: clonar, `npm install`, variables de entorno, `supabase migration up`, y **dónde está anotada la credencial fuera del PC**.

- [ ] **Step 1: Escribir las pruebas que fallan**

```ts
test('el respaldo incluye todo lo necesario para reconstruir el historial', async () => {
  const r = await armarRespaldo()
  expect(r.generadoEn).toBeTruthy()
  expect(Array.isArray(r.equipos)).toBe(true)
  expect(Array.isArray(r.fichas)).toBe(true)
  expect(Array.isArray(r.notasPosteriores)).toBe(true)
  expect(r.ajustes.nombre).toBe('AFIX')
})

test('el respaldo trae todas las versiones del catálogo, no solo la activa', async () => {
  const r = await armarRespaldo()
  expect(r.catalogos.length).toBeGreaterThanOrEqual(1)
  expect(r.catalogos.every(c => c.lineas.length > 0)).toBe(true)
})

test('una ficha congelada viaja con su versión de catálogo', async () => {
  const r = await armarRespaldo()
  const f = r.fichas.find(f => f.congeladaEn)!
  expect(r.catalogos.some(c => c.version === f.catalogoVersion)).toBe(true)
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/dominio/respaldo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `armarRespaldo` y la ruta de descarga**

La ruta devuelve el JSON con `Content-Disposition: attachment` y nombre con fecha.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/dominio/respaldo.test.ts`
Expected: PASS.

- [ ] **Step 5: Escribir el workflow del keepalive y el README**

- [ ] **Step 6: Correr la suite completa**

Run: `npx vitest run`
Expected: PASS, todo.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: respaldo exportable y keepalive de la base"
```

---

## Lo que este plan deja afuera a propósito

- **El servicio de lectura USB.** Plan aparte, posterior. Esta app funciona entera sin él.
- **El comando único que levanta la web y el servicio USB juntos** (§11 del diseño). Pertenece al plan del USB, porque hasta que ese servicio exista no hay dos procesos que levantar. Acá alcanza `npm run dev`.
- **Todo lo listado como no objetivo en §3 del diseño:** insumos, informes, fotos por ficha, precios, multiusuario, clientes como entidad, carga retroactiva de trabajos viejos, texto de garantía.
- **Exponer la app a la red local.** Decisión de §11: solo `localhost`, porque no hay login.
