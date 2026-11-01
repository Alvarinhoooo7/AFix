# Plan de implementación: rediseño del flujo AFix (solo iPhone)

**Fecha:** 1 de noviembre de 2026
**Base:** `docs/superpowers/specs/2026-10-28-plataforma-servicio-tecnico-design.md`. Este plan
lo reemplaza donde lo contradice (ver §1). Lo que no se toca acá sigue vigente: fichas
numeradas, checklist versionado, ficha congelada al entregar, la lectura USB nunca bloquea
el ingreso, la base en la nube y el respaldo.

---

## 0. El flujo completo, de punta a punta

```
 RECEPCIÓN                         TALLER                          ENTREGA
 ─────────                         ──────                          ───────
 1. Conectar por USB  ──┐                                          6. Conectar por USB otra vez
    (si enciende)       │          4. Reparación                      lectura de salida
 2. Inspección física   ├─► Ficha     trabajos hechos,             7. Comparación automática
    + funcionamiento    │  "Recibido" piezas cambiadas,               ingreso vs salida
 3. Cliente, pedido,    │             nota de taller               8. Checklist de salida
    accesorios,         │          5. "Listo para entregar"        9. Informe de entrega (PDF)
    cláusulas           │                                             ─► se envía al cliente
    ─► Comprobante de   │                                             ─► queda archivado
       ingreso (PDF) ───┘                                             ─► ficha congelada
```

Estados de la ficha: `recibido` → `en_reparacion` → `listo` → `entregado` |
`entregado_sin_reparar`.

---

## 1. Decisiones que cambian respecto del diseño anterior

| Antes | Ahora | Por qué |
|---|---|---|
| iPhone + Android (lector unificado) | **Solo iPhone e iPad** | Pedido del dueño. Se borra todo el camino ADB. |
| Sin comprobante al ingreso | **Comprobante de ingreso en PDF, con cláusulas** | Pedido del dueño. Además, la Ley 19.496 (art. 42) cuenta el plazo de abandono desde el "documento de recepción": sin documento, no hay plazo. |
| Voucher = página que se imprime | **PDF real, generado por el sistema, enviable y archivado** | Hay que mandarlo al cliente. Imprimir a mano desde el navegador no escala. |
| Sin archivos (sin Storage) | **Bucket privado en Supabase Storage solo para los PDF emitidos** | El registro tiene que ser *exactamente* lo que se envió. Si se regenera después y la plantilla cambió, ya no es prueba. |
| Sin texto de garantía | **Cláusulas y garantía editables en Ajustes, versionadas** | Pedido del dueño ("no nos hacemos cargo…", "se repara…"). |
| Script Python lanzado en cada lectura, ruta del venv fija en el código | **Agente USB que queda corriendo**, con aviso en vivo al conectar/desconectar | Arranca una vez (no 2–4 s por lectura) y la pantalla reacciona sola al enchufar. |
| Paleta verde "papel de talonario" | **Identidad AFix: negro y blanco del logo**, un rojo de alerta y un verde sobrio solo para "verificado" | Pedido del dueño con el logo. Se conservan los gestos útiles (timbre con el número, campos sobre línea en los documentos). |

**Se mantiene fuera:** fotos por ficha, precios/cobros, clientes como entidad, login,
inventario. (Si más adelante quieres fotos, el bucket de Storage ya existirá y es una
fase chica.)

---

## 2. Qué está mal hoy y se corrige

Encontrado al revisar el código actual:

1. **El lector inventa resultados.** `scripts/lector_usb.py` marca "Pantalla y táctil:
   Bien", "Face ID: Bien", "Carga: Bien" y todos los periféricos como "Operativo" solo
   porque el equipo respondió por USB. Que exista el número de serie del sensor de Face ID
   no prueba que Face ID funcione. En un reclamo eso es prueba falsa a favor del cliente.
   **Regla nueva: el USB solo afirma lo que leyó. Nunca marca una línea de funcionamiento
   como "Bien".** Lo que sí puede hacer es sugerir "Falla" con evidencia (p. ej. un
   registro de pánico que dice que falta el sensor de proximidad).
2. **Color fijo "Medianoche"** para cualquier equipo. Se lee `DeviceEnclosureColor` y se
   traduce por modelo.
3. **Capacidad mal redondeada**: no contempla 1 TB ni 2 TB.
4. **Ruta del Python escrita a mano** (`C:\Users\alvar\pmd3\...`, el venv desechable del
   spike) en `src/app/api/usb/escanear/route.ts`. Se mueve a configuración.
5. **Sin pruebas** para el lector (deuda ya anotada en el diseño §2.1).
6. **Si el equipo no está emparejado, falla todo**, aunque lockdown entrega modelo, iOS y
   UDID sin "Confiar". Y un equipo en modo recuperación (no arranca) también se puede
   identificar. Hoy eso se pierde.
7. **La salida se carga a mano** (`bateriaSalidaPct`/`bateriaSalidaCiclos`): no hay
   lectura USB de salida ni comparación de piezas.
8. **El reporte de periféricos se pega como texto en la observación** en vez de guardarse
   como datos.
9. Cambios sin commitear en `main` (inicio, historial, navegación, tokens). **Antes de
   empezar: revisarlos y commitearlos** para no mezclar trabajo viejo con el rediseño.

---

## 3. El agente USB — "más que 3uTools"

### 3.1 Arquitectura

- Servicio Python (FastAPI + uvicorn, ya vienen con pymobiledevice3) en
  `127.0.0.1:8765`, venv propio en ruta corta: `C:\afix-usb\venv` (este Windows no tiene
  rutas largas, diseño §6).
- Carpeta en el repo: `agente/` con `pyproject.toml` y versiones fijadas.
- `npm run taller` levanta Next.js y el agente juntos y abre el navegador. Un acceso
  directo en el escritorio que corre ese comando.
- La app web nunca habla con el iPhone; habla con el agente. Si el agente no está, la app
  funciona igual en modo manual y lo dice en una línea.

### 3.2 Endpoints

| Método | Ruta | Hace |
|---|---|---|
| GET | `/salud` | Agente vivo, versión, Apple Mobile Device Service OK o no |
| GET | `/eventos` | SSE: `conectado`, `desconectado`, `esperando_confianza`, `emparejado` |
| GET | `/equipos` | Equipos visibles y su **nivel de acceso** |
| POST | `/equipos/{udid}/emparejar` | Dispara el cuadro "¿Confiar en esta computadora?" |
| GET | `/equipos/{udid}/lectura` | Lectura completa (§3.4) |
| DELETE | `/equipos/{udid}/emparejamiento` | Borra el registro de emparejamiento del PC al entregar |

### 3.3 Tres niveles de lectura (para que "apagado/bloqueado" no sea todo o nada)

| Nivel | Cuándo | Qué se obtiene |
|---|---|---|
| **Recuperación / DFU** | No arranca, pero entra en modo recuperación | ECID, ProductType (modelo), número de serie, modo. Suficiente para identificar y buscar historial. |
| **Sin confianza** | Enciende, pero bloqueado o el cliente no da el código | Modelo, iOS y build, UDID, estado de activación (lo que lockdown entrega sin emparejar; confirmar con la sonda) |
| **Emparejado** | Desbloqueado y tocó "Confiar" | Todo lo de §3.4 |
| *Apagado / no detectado* | — | Nada. Ingreso manual, funcionamiento queda "No probado" y se activa la cláusula de §6. |

### 3.4 Qué se lee en nivel emparejado

Cada dato vuelve como `{ valor, fuente }`. Lo que el equipo no entrega dice **"No
informado por el equipo"**, nunca un valor de relleno.

| Bloque | Datos | Fuente |
|---|---|---|
| Identidad | Modelo comercial, ProductType, número de modelo + región (p. ej. MLPF3CL/A), color real, capacidad, IMEI, IMEI2, serie, ECID, UDID | lockdown |
| Sistema | iOS, build, versión de baseband y firmware | lockdown |
| Seguridad | Estado de activación, código configurado sí/no, **Buscar mi iPhone activo**, **bloqueo de activación**, **cuenta iCloud enmascarada** (`a•••••@gmail.com`) | lockdown `com.apple.fmip` → `IsAssociated`; NVRAM (`NonVolatileRAM`) → `fm-activation-locked`, `fm-account-masked` |
| Batería | Salud %, ciclos, capacidad de diseño vs. actual (mAh), temperatura, voltaje, carga actual, cargando sí/no, serie de la batería | diagnostics / IORegistry `AppleSmartBattery` |
| Almacenamiento | Total, usado, libre | `com.apple.disk_usage` |
| Red | Operador, estado de SIM y bandeja, MAC Wi-Fi y Bluetooth | lockdown |
| Piezas | Serie de pantalla, batería, cámara principal / ultra gran angular / tele / frontal, Face ID (IR y proyector), placa (MLB) | IORegistry |
| **Antecedentes de estabilidad** | Pánicos, reinicios forzados, bloqueos de sistema, falta de memoria, con fecha y hora de cada uno y **componente sospechoso** (§3.7) | crash reports (`com.apple.crashreportcopymobile`) |
| Carga | Cargador detectado al leer: tipo, watts, voltaje, corriente negociada | diagnostics `AdapterDetails` |

**Lo que 3uTools no muestra a primera vista y AFix sí:**

1. **Pánicos traducidos.** Un `panic-full` con `Missing sensor(s): prox` o `mic2` apunta a
   un flex concreto. El agente traduce las cadenas conocidas ("Falta el sensor de
   proximidad: revisar flex de la cámara frontal / auricular") y sugiere esa línea del
   checklist como "Falla" con la evidencia adjunta.
2. **Comparación ingreso vs. salida de piezas**: si cambió la serie de una pieza en la
   que no trabajaste, alerta roja. Si cambió la de la pieza que reparaste, queda
   registrado como prueba del cambio.
3. **Reconocimiento por cualquier identificador** (IMEI, serie, ECID, UDID): un iPad Wi-Fi
   sin IMEI o un equipo en recuperación igual encuentra su historial.
4. **Historial por equipo**: cada lectura queda guardada en la ficha; la segunda vez que
   llega el equipo ves cómo evolucionó la batería.
5. **Buscar mi iPhone con la cuenta enmascarada**: además de "activo / inactivo", muestra
   `a•••••@gmail.com` para confirmar con el cliente que es su cuenta antes de recibir el
   equipo. En rojo si el bloqueo de activación está puesto y el trabajo lo requiere
   apagado (restauración, cambio de placa).
6. **Antecedentes con fecha y hora, guardados como evidencia** (§3.7): el comprobante
   dice "el equipo ya registraba estas fallas antes de entrar", y el texto original de
   cada registro queda guardado en la base, visible en la ficha.
7. **Vigilancia en vivo durante las pruebas de salida**: mientras haces las pruebas
   físicas, el agente escucha si el iPhone genera un pánico, un bloqueo o un reinicio, y
   la pantalla lo marca en rojo en el momento.

### 3.5 Lo que el USB no puede decir (va escrito en la interfaz, sin disculpas)

Táctil, imagen de la pantalla, que la cámara saque foto bien, parlantes, micrófonos,
Face ID funcionando, botones, vibrador, estado físico. Eso es la inspección (§5). Bloqueo
por IMEI reportado (lista negra) requiere un servicio externo de pago: fuera de este plan.

### 3.6 Datos aún sin confirmar → la sonda va primero

**Ya probado** (1 de noviembre de 2026, iPhone 14 Plus `iPhone14,8`, iOS 27.0.1,
pymobiledevice3 11.49.1):

- Crash reports: se listan y se copian **sin borrar nada**. Hay archivos en la raíz, en
  `/Retired` (los más antiguos: en este equipo había una semana) y en
  `/ForceResetTailspins` (en este equipo había un mes). Formato `.ips`: primera línea con
  un JSON de encabezado (`bug_type`, `timestamp` con zona horaria, `os_version`) y luego
  un JSON con el cuerpo. Los `stacks` traen `reason` (p. ej. "BTAudioPlugin start
  condition timed out").
- Los `tailspin` pesan unos 55 MB cada uno: **se registran por nombre y fecha, no se
  copian**.
- Batería por `diagnostics`: capacidad de diseño y actual en mAh (4325 / 3393 = 78 %),
  ciclos (1176), voltaje, serie, `BatteryShutdownReason`, `DeadBatteryBootData` y el
  cargador conectado (`AdapterDetails`: "pd charger", 15 W, 5 V, 3 A). **No sale la
  temperatura** ni la resistencia interna.
- Color: `DeviceEnclosureColor` no viene; sí viene `DeviceColor` (número) y
  `ModelNumber` + `RegionInfo` (MQ593 + BE/A), así que el color se resuelve por número de
  modelo.
- **Buscar mi iPhone sí se lee, por dos vías independientes.** El dominio
  `com.apple.fmip` completo devuelve vacío, pero pidiendo la clave `IsAssociated` devuelve
  `true`. Además, la clave `NonVolatileRAM` de lockdown trae, en hexadecimal,
  `fm-activation-locked` (`YES` / `NO`) y `fm-account-masked` (la cuenta iCloud
  enmascarada, p. ej. `a•••••@gmail.com`). Si las dos vías no coinciden, se muestra
  "No concluyente" y el técnico lo verifica en Ajustes del iPhone. Falta confirmar si la
  NVRAM se lee sin emparejar.
- Reloj del iPhone: lockdown entrega `TimeIntervalSince1970` y `TimeZone`, que sirven para
  el aviso de desfase de §3.7.
- `MobileGestalt`, `NAND` y `WiFi` de diagnostics están deprecados en iOS 17.4 o más
  nuevo.

**Falta probar:** qué devuelve lockdown sin emparejar, los seriales de piezas por modelo,
si el historial de piezas de iOS ("pieza desconocida") sale por algún canal y, sobre todo,
**un equipo con `panic-full` real**. El iPhone de pruebas no tiene ninguno. Los iPhone de
garantía que se quedan pegados son justo los equipos que necesita la sonda.

**Paso 1 del plan:** `agente/sonda.py` vuelca todo lo legible a un JSON. Se corre con un
**cable de datos** (el problema del diseño anterior) en 3–4 iPhones de distintas
generaciones y versiones de iOS. Esos JSON, con IMEI/serie anonimizados, quedan como
`agente/pruebas/fixtures/` y son la base de las pruebas. Lo que no aparezca, se oculta
de la interfaz; no se promete.

### 3.7 Antecedentes de estabilidad ("el equipo se queda pegado")

**Objetivo:** que el comprobante de ingreso pueda decir, con fecha, hora y archivo
original, que el equipo **ya presentaba** fallas antes de entrar al taller, y que en la
salida se compruebe que no hubo ninguna falla nueva después de la reparación.

**Qué se lee** (copiar y listar, nunca `--erase`, nunca `clear`):

| Archivo | Qué significa | Peso | Se copia |
|---|---|---|---|
| `panic-full-*` (`bug_type` 210, confirmar) | Pánico del kernel: el equipo se colgó y se reinició solo | Alto | Sí |
| `ForceResetTailspins/tailspin-trace_reset_*` | **Reinicio forzado con los botones**: el equipo quedó pegado y alguien lo forzó | Alto | No, solo nombre y fecha |
| `stacks-*` (`bug_type` 288) | iOS detectó un proceso del sistema que dejó de responder (`reason`) | Medio | Sí |
| `ResetCounter-*` | Contador de reinicios (confirmar con la sonda) | Medio | Sí |
| `JetsamEvent-*` (`bug_type` 298) | Falta de memoria: iOS cerró apps (`largestProcess`) | Bajo: apps o almacenamiento, no hardware | Solo el resumen |
| `*.cpu_resource`, `*.diskwrites_resource`, `SiriSearchFeedback`, `SFA-*`, `xp_amp_*` | Ruido del sistema | No cuenta | No |

Se recorren la raíz, `/Retired` y `/ForceResetTailspins`. Antes de listar se llama a
`flush` (`com.apple.crashreportmover`) para que aparezcan los reportes pendientes.

**Traductor de pánicos** (`agente/afix_usb/panicos.py`, reglas en un archivo de datos
para sumar casos sin tocar código). De cada `panicString` se sacan la primera línea, los
`Missing sensor(s): …` y el proceso, y se buscan en la tabla:

| Patrón | Causa probable | Línea del checklist sugerida |
|---|---|---|
| `Missing sensor(s): mic1` / `mic2` + reinicio cada ~3 min | Flex del puerto de carga o del micrófono | Carga / Micrófono |
| `Missing sensor(s): prs0` | Barómetro (según el modelo, en el flex de carga) | Carga |
| `Missing sensor(s): TG0B` / `TG0V` | Batería o su conector (pasa mucho con baterías genéricas) | Batería |
| `Missing sensor(s): prox` / `ALS` | Flex de la cámara frontal y el auricular | Sensor de proximidad |
| `watchdog timeout` / `no checkins from watchdogd` | Un periférico no responde (se cruza con los demás pánicos) | — |
| `ANS2` / `NAND` | Almacenamiento (placa) | — |
| `SEP` / `AOP` | Placa o un componente asociado (Face ID, sensores) | Face ID |
| `thermalmonitord` | Sensor térmico | — |
| *(cualquier otro)* | "Pánico no clasificado": se guarda igual, con su texto | — |

La tabla va **por validar** con pánicos reales (fase 1). La interfaz siempre dice "causa
probable", nunca "diagnóstico".

**Contexto que se agrega a la lectura**, porque explica un "se pega" sin falla de placa:
- Batería bajo 80 % o con muchos ciclos: "iOS puede estar limitando el rendimiento".
- Almacenamiento libre bajo 5 %: "almacenamiento casi lleno".
- **Hora del iPhone contra la hora del PC** al leer. Si la diferencia es grande, se avisa,
  porque las fechas de los registros salen del reloj del iPhone.

**Qué se guarda en el ingreso:**
- En `lectura_ingreso.estabilidad`: fecha y hora de la lectura, desde qué fecha hay
  registros (el archivo más antiguo encontrado), conteos por tipo (total y últimos 7 días)
  y la lista de eventos `{ tipo, fecha_hora, resumen, causa_probable, archivo }`.
- **No se guardan archivos de registro.** De cada pánico, `stacks` o `ResetCounter`, el
  agente saca **el texto que importa** y lo guarda como texto en la tabla
  `registro_equipo` (§4): el encabezado (`bug_type`, fecha, iOS), el `panicString`
  completo, o el `reason` y las `notes` en un `stacks`. Son unos pocos KB por evento. Se
  guarda también el `sha256` del archivo original, para poder cotejarlo con el iPhone si
  hiciera falta. El archivo no se copia a ningún lado, y el agente lo lee en memoria sin
  dejar copias en el PC.
- En la ficha, cada evento se abre **como texto en la web**: el texto original del
  iPhone tal cual, con su traducción al lado. No se descarga nada.

**Texto automático para el comprobante** (ejemplo con el iPhone de pruebas):

> Antecedentes leídos por USB el 01-11-2026 19:12 (registros disponibles desde el
> 05-10-2026): **3 reinicios forzados** (05-10-2026, 18:31, 23:23 y 23:58), **1 bloqueo
> de sistema** (30-10-2026 06:52, audio Bluetooth), 0 pánicos. Batería 78 % con 1176
> ciclos: iOS puede estar limitando el rendimiento.

Si no hay ningún evento: "Sin fallas de estabilidad registradas en el equipo desde el
05-10-2026". Nunca dice "sin fallas", porque iOS borra los registros antiguos.

**En la salida:**
1. Nueva lectura. Se marca como **nueva** toda falla con fecha posterior al ingreso, y
   en rojo si es posterior a "listo para entregar".
2. **Vigilancia en vivo** (`GET /equipos/{udid}/vigilancia`, SSE sobre `crash watch`):
   se activa mientras haces las pruebas físicas. Cualquier pánico, `stacks` o reinicio
   aparece en pantalla en el momento, con su traducción.
3. El informe de entrega lleva un bloque **Estabilidad antes y después**: lo que había al
   ingreso, lo que apareció durante la reparación y "0 fallas nuevas durante las pruebas
   de salida (vigilancia de 25 min)".

---

## 4. Modelo de datos (migraciones 0009 en adelante)

- `ficha`
  - `estado`: agregar `recibido`, `en_reparacion`, `listo` (migrar `en_taller` → `recibido`).
  - `lectura_ingreso jsonb`, `lectura_salida jsonb`: la lectura USB completa con fecha y
    nivel. Es la prueba; los campos sueltos actuales (iOS, batería) se siguen llenando
    desde ahí para buscar y listar.
  - `accesorios jsonb`: funda, mica/protector, chip SIM, bandeja, cargador, cable, caja, otro.
  - `codigo_entregado boolean`: si el cliente dejó el código. **Nunca se guarda el
    código.** Se le pide en el momento y se escribe en papel o se le pide que vuelva a
    teclearlo.
  - `clausulas_version integer`, `garantia_meses integer` (copia del valor de Ajustes al
    emitir; por defecto 3).
  - `piezas_cambiadas jsonb`: por trabajo, pieza y calidad (original / compatible). Sirve
    para la garantía y para explicar el aviso "pieza desconocida" de iOS.
- `equipo`: agregar `udid`, `numero_modelo`, `region`. La búsqueda de "ya pasó por el
  taller" usa IMEI, serie, ECID o UDID.
- `documento`: `ficha_numero`, `tipo` (`ingreso` | `salida`), `emitido_en`, `sha256`,
  `ruta_storage`, `enviado_en`. Un PDF emitido no se reemplaza; si hay que corregir, se
  emite uno nuevo y queda el historial.
- `registro_equipo`: `ficha_numero`, `momento` (`ingreso` | `salida` | `vigilancia`),
  `tipo` (`panic` | `reinicio_forzado` | `stacks` | `reset_counter` | `jetsam`),
  `fecha_evento` (del iPhone), `nombre_original`, `texto` (el extracto original, §3.7),
  `causa_probable`, `sha256` (del archivo original), `leido_en`. Solo texto, sin archivos.
  Igual que `documento`, no se reemplaza ni se borra.
- `clausulas`: versionadas igual que el catálogo del checklist (una ficha vieja muestra
  el texto que aceptó el cliente).
- `ajustes_taller`: agregar RUT/razón social (opcional), correo, Instagram/WhatsApp,
  `garantia_meses` (por defecto **3**). Todo editable cuando quieras desde Ajustes; los
  PDF ya emitidos no cambian porque quedan archivados tal como se enviaron.
- `modelo_iphone` → `modelo_apple`: agregar iPads y la tabla de colores por modelo.
- Quitar todo lo de Android.
- **Respaldo** (`/api/respaldo`): pasa a ser un `.zip` con el JSON actual + los PDF.

---

## 5. Checklist versión 2 (inspección física + funcionamiento)

**Estado físico** (cada línea con sus estados y nota opcional):

| Línea | Estados |
|---|---|
| Vidrio de pantalla | Sano / Rayas leves / Rayas profundas / Trizado / Quebrado |
| Imagen de pantalla | Normal / Manchas / Líneas / Píxeles muertos / Quemada / Sin imagen / No verificable |
| Marco / chasis | Sano / Rayado / Golpes / Doblado |
| Vidrio trasero | Sano / Rayado / Trizado / Quebrado |
| Lentes de cámara | Sanos / Rayados / Trizados |
| Botones (físico) | Completos / Hundidos / Faltan |
| Puerto de carga | Limpio / Con suciedad / Dañado |
| Bandeja SIM | Presente / Ausente |
| Tornillos inferiores | Presentes / Faltan / No originales |
| Apertura previa | Sin señales / Con señales |
| Indicador de humedad | Sin indicio / Activado / No visible |

**Funcionamiento** (Bien / Falla / No probado): las 13 líneas actuales, más Flash y
Linterna, Llamada (auricular + micrófono), Teclado / táctil en bordes.

Reglas:
- Botón **"Equipo apagado o sin acceso"**: marca todo funcionamiento como "No probado" de
  una vez y activa la cláusula de §6.2.
- La lectura USB **nunca** marca "Bien". Puede proponer "Falla" con evidencia, y el
  técnico confirma.
- El checklist de salida arranca con lo del ingreso a la vista, al lado, y cada línea se
  confirma (no se copia sola: copiar el ingreso a la salida es justo lo que no tiene que
  pasar).

---

## 6. Documentos

### 6.1 Generación, archivo y envío

- Las plantillas son componentes React con hoja de estilos de impresión (como el voucher
  actual): lo que ves en pantalla es lo que sale.
- El PDF lo genera el servidor con **playwright-core usando Microsoft Edge** (viene con
  Windows 11, no hay que descargar Chromium). `page.pdf()` en tamaño carta.
- Al emitir: se sube a Supabase Storage (bucket privado `documentos/2026/0052-ingreso.pdf`),
  se guarda el `sha256` en `documento` y queda disponible para descargar.
- **Enviar al cliente:** botón "Compartir" (hoja de compartir de Windows, con el archivo
  adjunto → WhatsApp Desktop o correo). Alternativa siempre visible: "Descargar PDF" +
  "Abrir chat de WhatsApp" con el número del cliente y un texto listo
  (`wa.me/569…`). Se marca `enviado_en` al compartir.
- **Logo:** `LOGO.jpg` mide 176×176 px y sale pixelado en papel. **Decidido: se
  redibuja en SVG** (`public/marca/afix.svg` y variante blanca sobre negro), calcando la
  forma del JPG. Se usa en la barra, en los PDF y como ícono de la pestaña.

### 6.2 Comprobante de ingreso

Encabezado AFix (logo, datos del taller), **N° de ficha como timbre**, fecha y hora.
Cliente y teléfono. Equipo (modelo, color, capacidad, IMEI, serie) y de dónde salió cada
dato (USB / declarado). Lo que pidió el cliente. Estado físico. Funcionamiento verificado
y lo que quedó "No probado". Resumen de la lectura USB (batería, Buscar mi iPhone,
activación) o "Equipo recibido sin acceso por USB". **Antecedentes de estabilidad**
con el texto automático de §3.7 y la lista de eventos con fecha y hora. Accesorios recibidos.
Cláusulas. Línea de firma del cliente (para la copia impresa).

**Cláusulas v1**, redactadas bajo la Ley 19.496 de protección al consumidor (decisión
del dueño). Editables en Ajustes; cada cambio crea una versión nueva y las fichas viejas
conservan la que aceptó el cliente:

1. **Revisión limitada.** El estado de los componentes y funciones marcados como "No
   probado" no pudo verificarse al momento de la recepción (equipo apagado, bloqueado o
   sin acceso). AFix no se hace responsable por fallas en esos componentes o funciones
   detectadas después de la recepción.
2. **Estado previo.** El equipo se recibe en el estado físico descrito en este
   documento. Daños, rayas o golpes no descritos y visibles se entienden preexistentes
   salvo que AFix los haya causado.
3. **Riesgo propio de la reparación.** Equipos con daño por líquido, golpes, apertura
   previa o reparaciones de terceros pueden presentar fallas nuevas durante o después de
   la intervención, ajenas al trabajo realizado.
4. **Piezas y avisos de iOS.** Al reemplazar ciertas piezas, iOS puede mostrar el aviso
   "pieza desconocida" o desactivar funciones asociadas (por ejemplo True Tone o el
   porcentaje de salud de batería), sin que ello afecte el funcionamiento de la pieza.
5. **Datos personales.** AFix no accede al contenido personal del equipo. Se recomienda
   respaldar la información antes de entregarlo; AFix no responde por pérdida de datos.
6. **Accesorios.** AFix solo responde por los accesorios listados en este documento.
7. **Retiro.** Las especies no retiradas en el plazo de un año desde la fecha de este
   documento se entienden abandonadas a favor de AFix (art. 42, Ley 19.496).
8. **Garantía.** El trabajo realizado tiene una garantía de **3 meses** desde la fecha
   de entrega, conforme a la Ley 19.496, sobre la pieza reemplazada y la mano de obra.
   No cubre golpes, humedad, mal uso ni intervención de terceros. (El "3 meses" sale de
   `garantia_meses` en Ajustes.)
9. **Antecedentes de fallas.** Los registros de diagnóstico del propio equipo, leídos al
   momento de la recepción y detallados en este documento, dan cuenta de fallas
   anteriores al ingreso. AFix conserva una copia de esos registros. Estas fallas no se
   atribuyen a la intervención de AFix, y su reparación solo está incluida si se indica
   en el trabajo solicitado.

### 6.3 Informe de entrega

Encabezado y timbre. Fechas de ingreso y entrega. Equipo. **Trabajos realizados y piezas
cambiadas.** **Antes y después**: batería (79 % / 743 ciclos → 100 % / 0), piezas cuya
serie cambió, iOS. **Estabilidad antes y después** (§3.7): fallas al ingreso, fallas
nuevas después del ingreso y el resultado de la vigilancia durante las pruebas de salida. Los dos checklists lado a lado. Observaciones de ingreso y
salida. Garantía: 3 meses desde la fecha de entrega, con la fecha de vencimiento
impresa (p. ej. "Garantía hasta el 1 de febrero de 2027").
Firma de recepción conforme.

No lleva: la nota de taller (es tuya).

---

## 7. Pantallas

**Comunes:** barra negra con el logo AFix, buscador siempre arriba (`Ctrl+K`), botón
"Nuevo ingreso". Objetivos de clic grandes, se usa con el teclado, contraste AA.

1. **Panel.** Tarjeta "Equipo conectado" que aparece sola al enchufar un iPhone (modelo,
   nivel de acceso, si ya pasó por el taller y su última ficha, botones "Nuevo ingreso
   con este equipo" / "Leer para entrega" si tiene una ficha abierta). Debajo, tres
   columnas: Recibidos · En reparación · Listos para entregar, con cuántos días lleva
   cada uno. Últimas entregas.
2. **Nuevo ingreso**, en cuatro pasos con barra de avance (se puede volver atrás, se
   guarda borrador local):
   1. *Equipo* — USB automático si está conectado; si no, "Cargar a mano" o "Equipo
      apagado". Aviso de historial si ya vino antes.
   2. *Inspección* — estado físico y funcionamiento, con el resultado USB al lado
      (pánicos, batería, Buscar mi iPhone en rojo si está activo).
   3. *Cliente* — nombre, teléfono, qué pide, accesorios, si dejó el código.
   4. *Revisar y emitir* — vista previa del comprobante → "Emitir y compartir".
3. **Ficha.** Línea de tiempo (recibido, en reparación, listo, entregado, notas),
   trabajos y piezas cambiadas, nota de taller, documentos emitidos con su fecha de envío.
   **Registros del equipo**: la lista de eventos (ingreso, salida y vigilancia) con su
   fecha. Cada uno se abre como texto, con el original del iPhone y su traducción.
4. **Entrega**, en tres pasos: *Lectura de salida* (USB + tabla de diferencias con
   alertas) → *Checklist de salida* (ingreso al lado, con la **vigilancia en vivo**
   corriendo: un contador de minutos y "0 fallas" o la falla en rojo apenas aparece) →
   *Revisar y emitir informe*. Al
   emitir: ficha congelada y opción de borrar el emparejamiento del PC.
5. **Historial / búsqueda** por número, IMEI, serie, modelo, cliente o teléfono.
6. **Ajustes.** Datos del taller (nombre, dirección, teléfono, correo, Instagram/
   WhatsApp, RUT opcional), editables cuando quieras; garantía en meses (3 por defecto);
   cláusulas (crear nueva versión); catálogo del checklist (crear nueva versión); estado
   del agente USB.

---

## 8. Fases y orden de ejecución

Cada fase termina con pruebas pasando y un commit. Las fases 1 y 2 se pueden hacer en
paralelo.

| # | Fase | Entregable | Depende de |
|---|---|---|---|
| 0 | **Ordenar** | Commitear los cambios pendientes de `main`; rama `rediseno-iphone`; quitar Android y el prellenado falso del lector | — |
| 1 | **Sonda** | `agente/sonda.py`; JSON de 3–4 equipos reales como fixtures (**al menos uno de los iPhone de garantía que se quedan pegados**, con sus `.ips` anonimizados); lista final de qué se lee por iOS | iPhone de pruebas (listo), equipos de garantía |
| 2 | **Datos** | Migraciones 0009+ (§4), checklist v2 y cláusulas v1 sembradas, tipos Drizzle y dominio actualizados | 0 |
| 3 | **Agente USB** | FastAPI con §3.2–3.4, antecedentes de estabilidad y traductor de pánicos (§3.7), vigilancia en vivo, pruebas con pytest contra los fixtures, `npm run taller` | 1 |
| 4 | **Identidad visual** | Logo redibujado en SVG, tokens nuevos, barra, componentes base (botón, campo, paso, tarjeta, tabla de diferencias) | 0 |
| 5 | **Ingreso** | Panel con tarjeta de equipo conectado + asistente de ingreso de 4 pasos | 2, 3, 4 |
| 6 | **Documentos** | Plantillas de comprobante e informe, PDF con Edge, Storage, `documento`, compartir/WhatsApp | 2, 4 |
| 7 | **Reparación y entrega** | Estados, piezas cambiadas, lectura de salida con comparación, asistente de entrega, congelado | 3, 5, 6 |
| 8 | **Respaldo y cierre** | Respaldo `.zip` con PDF, README actualizado, prueba de punta a punta con un iPhone real (ingreso → reparación → entrega → PDF en WhatsApp) | todo |

### Pruebas

- **Agente:** pytest contra los fixtures de la sonda; casos sin equipo, sin confianza,
  recuperación, campos ausentes, pánicos conocidos y desconocidos, `.ips` dañados o
  truncados, equipo sin ningún registro, y **que nunca se llame a `erase` ni a `clear`**.
- **App:** vitest como hoy (base local `_test`) para migraciones, estados, comparación
  ingreso/salida, versionado de cláusulas; el agente se simula con un servidor falso que
  sirve los fixtures.
- **PDF:** que se genera, que el `sha256` coincide con el archivo de Storage, que una
  ficha vieja sale con sus cláusulas y su catálogo.
- **Manual con equipo real**, al final de las fases 3, 5 y 7.

---

## 9. Decisiones cerradas con el dueño (1 de noviembre de 2026)

- **Logo:** se redibuja en SVG a partir de `LOGO.jpg`.
- **Cláusulas:** se mantienen bajo la Ley 19.496, con el texto de §6.2.
- **Datos del taller:** se cargan y se cambian desde Ajustes cuando quiera; no van
  escritos en el código.
- **Garantía:** 3 meses desde la entrega.

## 10. Lo que falta para avanzar

1. ~~Un cable de datos y un iPhone de pruebas~~: listo (iPhone 14 Plus, iOS 27.0.1, leído
   el 1 de noviembre de 2026). pymobiledevice3 11.49.1 está instalado en
   `C:\Users\alvar\pmd3`, que es la ruta que usa hoy el lector; en la fase 3 pasa a
   `C:\afix-usb\venv`.
2. **Los iPhone de garantía que se quedan pegados**, conectados por USB antes de
   repararlos, para la sonda: son los únicos que van a traer pánicos reales con los que
   validar el traductor.
3. Cargar los datos del taller en Ajustes una vez que esté lista la pantalla (fase 4–6).

## 11. Estado de la implementación (1 de noviembre de 2026)

Las fases 0 a 8 están implementadas en la rama `rediseno-iphone`. Pruebas: 151 de la app
(vitest) y 56 del agente (pytest). Hay una prueba de punta a punta en local (ingreso a mano →
reparación → entrega, con los dos PDF reales generados por Edge, archivados y verificados
contra su huella, y el respaldo zip con ambos).

**Desviaciones respecto del plan:**

- **Color:** iOS 27 no entrega `DeviceEnclosureColor` y `DeviceColor` es solo un número, así
  que no hay una tabla fiable de colores. El color queda como dato declarado, y la lectura
  guarda los códigos crudos por si más adelante se arma la tabla.
- **`modelo_iphone` conserva su nombre** (no se renombró a `modelo_apple`). Se agregaron
  iPads con identificadores seguros; los iPhone 17 quedan fuera hasta confirmar sus códigos.
- **Vigilancia:** en vez de `crash watch` (que depende del syslog y se corta cuando el
  equipo se reinicia), el agente revisa la lista de registros cada 5 segundos y compara.
  Así detecta también los reinicios forzados y los pánicos que aparecen después de que el
  iPhone vuelve.
- **Modo recuperación:** se detecta con `IRecv`, pero en Windows depende del driver de
  Apple y no está probado con un equipo real.

**Pendiente con equipos reales:**

1. Fixture anonimizado del iPhone de pruebas
   (`python -m afix_usb.sonda agente/pruebas/fixtures/iphone14plus-ios27.json --anonimo`):
   el iPhone se desconectó antes de capturarlo.
2. Un `panic-full` real (iPhone de garantía) para validar `reglas_panicos.json`.
3. Lectura sin «Confiar» (qué entrega lockdown) y la NVRAM de Buscar mi iPhone en ese nivel.
4. Aplicar las migraciones 0009 y 0010 a Supabase en la nube, y cargar `SUPABASE_URL` y
   `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`.
