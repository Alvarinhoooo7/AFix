# Plataforma de servicio técnico — AFIX

**Fecha:** 28 de octubre de 2026
**Dueño:** Álvaro (técnico, trabaja solo). El taller se llama **AFIX**.
**Estado:** revisado por un constructor independiente y completado con las respuestas
del dueño. Listo para planificar.

---

## 1. Intención y por qué

Álvaro repara iPhones solo, hoy casi exclusivamente cambios de pieza: batería,
parlantes, cámaras. Su flujo actual es: recibe el equipo, lo pasa por **3uTools** para
ver el estado, saca un screenshot y lo guarda; repara; repite el screenshot. El
respaldo de su trabajo son dos capturas de pantalla sueltas en una carpeta.

Eso le falla en tres cosas:

1. **No tiene constancia del estado en que entró el equipo.** Si el cliente vuelve
   diciendo que el Face ID no funciona, no tiene nada escrito que diga que ya venía así.
2. **No puede saber si un equipo que llega ya pasó por sus manos.** No tiene historial
   consultable por equipo.
3. **Depende de 3uTools**, un software de terceros, y quiere esa lectura dentro de su
   propio sistema.

Lo que quiere construir es el registro que hoy no existe: una ficha por trabajo, con
checklist de ingreso y de salida, los datos duros del equipo leídos automáticamente por
USB, y un **voucher** que le entrega al cliente al devolver el equipo.

El valor central no es administrar un taller. Es **tener prueba de lo que recibió y de
lo que hizo**.

---

## 2. Objetivos

- Una ficha por cada trabajo, buscable, que sobreviva a la muerte del PC.
- Checklist de ingreso y checklist de salida, con estados explícitos y notas.
- Datos duros del equipo (IMEI, serie, modelo, capacidad, iOS, batería) leídos por USB
  desde el propio sistema, sin 3uTools.
- Al conectar un equipo, saber de inmediato si ya pasó por el taller y poder abrir la
  ficha anterior.
- Un voucher imprimible con todo lo anterior, para entregar con el equipo.

## 3. No objetivos

Fuera de alcance, decidido explícitamente por el dueño:

- **Insumos y stock.** "Me da lo mismo." No hay inventario, ni repuestos como entidad,
  ni costos de pieza.
- **Informes y estadísticas.** Los trabajos son para un círculo conocido.
- **Fotos de equipos.** Pedido explícito: "omite lo de las fotos". No hay subida de
  imágenes por ficha, ni bucket de archivos. Todo lo que se guarda por trabajo es texto
  y números. *(Única excepción: el logo de AFIX, ver §9.6 — es un archivo estático del
  proyecto, no un sistema de subida.)*
- **Precios y cobros.** El dueño nunca los mencionó. **Al constructor:** dejá el modelo
  de datos de forma que agregar un monto a la ficha después sea una columna, no una
  refactorización.
- **Multiusuario, roles, login.** Lo usa una sola persona, en su propio PC.
- **Clientes como entidad con ficha propia.** Ver §7.3.
- **Carga retroactiva de trabajos viejos.** Respuesta del dueño: parte de cero. No se
  construye ningún modo de ingreso histórico.
- **Texto de garantía en el voucher.** Se le ofreció y no lo quiso. No se inventa. Si
  más adelante lo pide, es un campo más en los ajustes del taller y un bloque en la
  plantilla de impresión.
- **Comprobante impreso al ingreso.** Ver §9.1.

## 4. Anti objetivos

Cosas que harían fracasar esto aunque funcione técnicamente:

- **Que la lectura por USB sea obligatoria para ingresar un equipo.** Buena parte de los
  equipos que recibe están apagados, con pantalla rota o no se pueden desbloquear. Si el
  cable es un requisito, el sistema no sirve en la mitad de los casos. **Esta es la
  restricción más importante del documento.**
- **Que se convierta en un CRM o un ERP.** Cada campo que no le sirve a una persona sola
  reparando un teléfono es una razón para no usarlo.
- **Que el historial viva solo en el disco del PC.** El miedo declarado del dueño es
  perder la máquina y quedarse sin respaldo de lo que hizo.
- **Que el cliente tenga que mirar una pantalla.** Lo único que el cliente ve es el
  voucher. La interfaz es herramienta de banco de trabajo, para una persona con las
  manos ocupadas.

---

## 5. Restricciones

- **Windows 11.** Es la máquina del dueño y la única donde se conecta el iPhone.
- **Una sola persona, un solo PC.** La portabilidad a otro PC es para el caso de pérdida
  o reemplazo de la máquina, no para trabajar desde dos lugares.
- **El código va a GitHub. Los datos no.** Los datos viven en una base en la nube, para
  que al clonar en otra máquina el historial esté ahí.
- **Todo en español**, con vocabulario **chileno neutro**. Ninguna cadena visible en
  inglés, incluidos estados, botones y mensajes de error. *Nota: los mockups de la
  sesión de diseño quedaron escritos en voseo rioplatense ("cargás", "apretás"). Eso es
  un desliz de los mockups, no la voz del producto. Usá formas neutras ("cargas",
  "puedes") y el documento manda sobre los mockups.*
- **Dos datos del equipo están sin verificar.** Ver §8.3. El diseño funciona igual si
  resultan imposibles de leer.

---

## 6. Entorno ya preparado en la máquina del dueño

Instalado y verificado el 28 de octubre de 2026:

| Pieza | Versión | Nota |
|---|---|---|
| Apple Mobile Device Support | 19.4.0.10 | Servicio *Apple Mobile Device Service* en **Running**, escuchando en `127.0.0.1:27015`. Instalado suelto, sin iTunes. |
| Python | 3.12.10 | Instalado aparte. El 3.14.4 del sistema no sirve: `pylzss`, dependencia de pymobiledevice3, no tiene wheel para 3.14 y exige Visual Studio para compilar. |
| pymobiledevice3 | 11.45.1 | En un venv en `C:\Users\alvar\pmd3`. Es del spike y es desechable; el proyecto crea el suyo. |
| Node | 25.9.0 | |
| CLI de Supabase | 2.98.2 | Hay 2.122.0 disponible; actualizar es opcional. |
| Docker | 29.8.1 | Confirmado. `supabase start` levanta la base local, así que las pruebas corren contra Postgres de verdad sin tocar la nube. |
| Otros | winget, scoop, chocolatey, git 2.54 | |

**Cuidado con las rutas largas:** este Windows no tiene habilitado el soporte de rutas
largas. Un `venv` creado dentro de una carpeta ya profunda falla al instalar
(`jedi/third_party/django-stubs/...` excede el límite). El venv del proyecto tiene que
vivir en una ruta corta.

---

## 7. Modelo de datos

Dos entidades, más una fila de configuración. Nada más.

### 7.1 `equipo` — el teléfono físico

Es lo que permite reconocer un aparato que vuelve.

- **Clave interna propia** (no el IMEI). *Decisión mía, ver abajo.*
- `imei` — **opcional**, único cuando está presente
- `imei2`, `numero_serie`, `ecid`
- `modelo_producto` (lo que devuelve el equipo, p. ej. `iPhone13,2`)
- `modelo_comercial` (lo que entiende una persona, p. ej. `iPhone 12`)
- `capacidad`, `color`
- `creado_en`

**Por qué el IMEI no es la clave primaria, aunque sea el identificador natural
(decisión mía).** El anti objetivo principal dice que el ingreso nunca se bloquea. Un
equipo que llega apagado y con la pantalla rota muchas veces no entrega el IMEI por
ninguna vía: no se lee por USB, no se puede ver en Ajustes, y no siempre está legible en
la bandeja SIM. Si el IMEI fuera obligatorio, ese equipo no se podría ingresar, y eso
rompe lo más importante del diseño.

Entonces: clave interna, `imei` nullable y único cuando existe. Y hace falta **vincular
después**: cuando el equipo enciende a mitad de la reparación y aparece el IMEI, el
sistema tiene que detectar si ese IMEI ya tenía historia y ofrecer unir los dos
registros, en vez de dejar un duplicado. Sin eso, el historial por equipo —que es el
valor central— se llena de huérfanos.

### 7.2 `ficha` — un trabajo, de ingreso a entrega

- `numero` (correlativo visible, el del timbre del voucher: `0052`)
- `equipo_id`
- `estado`: `en_taller` | `entregado` | `entregado_sin_reparar`
- `recibido_en`, `entregado_en`, `congelada_en`
- **Lo que pidió el cliente** (texto libre)
- **Quién lo trajo** y **teléfono** (texto libre, opcionales)
- Datos del equipo *al momento de esta ficha*: `ios_version`, `build`, `bateria_pct`,
  `bateria_ciclos`, `codigo_protegido`, `estado_activacion`
- `origen_datos`: `usb` | `manual` | `mixto`
- `trabajos_realizados` (lista)
- `nota_reparacion` (texto libre)
- `observacion_ingreso`, `observacion_salida` (texto libre)
- `checklist_ingreso`, `checklist_salida`

**Por qué los datos del equipo se repiten acá y no solo en `equipo`:** la versión de
iOS, el porcentaje y los ciclos de batería cambian entre un trabajo y otro. El sentido
de todo esto es poder decir "cuando lo recibí estaba así". Si se guardan solo en
`equipo` se sobreescriben y se pierde la prueba.

**`entregado_sin_reparar` es decisión mía.** Pasa en la vida real: no se pudo, el
repuesto no llegó, el cliente se arrepintió. Sin ese estado, esos casos quedan colgados
en `en_taller` para siempre o se cierran como si se hubieran reparado. El voucher de una
ficha así imprime el checklist de ingreso y la razón, sin inventar un trabajo que no se
hizo.

### 7.3 Por qué no hay tabla de clientes

Decisión mía, por declaración del dueño de que los trabajos son para un círculo conocido
y que no necesita informes. "Quién lo trajo" y "teléfono" son dos campos de texto en la
ficha, sin entidad propia ni historial por persona. **El historial que importa es por
equipo, no por persona.** El buscador sí busca dentro de esos campos (§9.5), así que
escribir un nombre y encontrar el equipo funciona igual. Si algún día quiere clientes de
verdad, los datos ya están y es una migración chica.

### 7.4 `ajustes_taller` — una sola fila

Nombre (`AFIX`), teléfono, dirección, y la referencia al logo. Ver §9.6.

### 7.5 Editar y congelar

Respuesta del dueño: **editable mientras está en taller, congelada al entregar.**

- Ficha `en_taller`: todo editable, incluido el checklist de ingreso.
- Al cerrar y entregar: se sella. Se guarda `congelada_en`. Lo que se imprimió en el
  voucher es lo que queda.
- Después de congelada, **no se edita**. Si hay algo que corregir, se agrega una nota
  con su fecha que no pisa lo original.

Esto es lo que hace que el voucher sirva como prueba y no sea solo un papel bonito.

---

## 8. La lectura por USB

### 8.1 Cómo

El reemplazo de 3uTools es **pymobiledevice3**, implementación en Python del protocolo
*lockdown* de Apple — el mismo que usa 3uTools por debajo. Requiere que el equipo esté
desbloqueado y que el usuario toque **Confiar** una vez por máquina.

Arquitectura: un **servicio local en Python** que envuelve pymobiledevice3 y expone HTTP
en `127.0.0.1`, que la app web consulta. FastAPI y uvicorn ya vienen como dependencias
de pymobiledevice3, así que no agregan nada nuevo.

Decisión mía, y la razón: la app web es JavaScript y pymobiledevice3 es Python. En vez de
buscar una implementación del protocolo en JS (las que hay son menos maduras y siguen
peor los cambios de iOS), se mantiene la librería buena y se la expone por un puerto
local. El costo es que hay dos procesos corriendo.

Un solo endpoint hace falta: devolver los datos del equipo conectado, o un error que
explique qué pasó (no hay equipo / no se tocó Confiar / está bloqueado).

### 8.2 Campos que se leen y son seguros

Confirmados como parte del protocolo lockdown, vía `get_value`: IMEI, IMEI2, número de
serie, `ProductType`, `HardwareModel`, nombre del equipo, versión de iOS, build, color,
color de carcasa, capacidad total, región, estado de activación, si tiene código, ECID,
MAC de Wi-Fi, MAC de Bluetooth.

**`ProductType` → modelo comercial.** El equipo dice `iPhone13,2`, no "iPhone 12". Hace
falta una tabla de equivalencias en el proyecto. Tiene que degradar con gracia: si llega
un `ProductType` que no está en la tabla (modelo nuevo), mostrar el código crudo y dejar
que el dueño escriba el nombre comercial a mano, no fallar.

### 8.3 Los dos datos sin verificar

**No están confirmados y no se le prometieron al dueño:**

1. **Ciclos de batería y capacidad de diseño.** Se obtienen por el canal de diagnóstico
   (`DiagnosticsService`, `ioregistry` sobre `IOPMPowerSource` / `AppleSmartBattery`).
   Apple ha ido restringiendo ese canal en versiones recientes de iOS.
2. **Historial de piezas y reparaciones** (el "piezas desconocidas" de Ajustes →
   General → Información, iOS 15.2+). No está confirmado que se exponga por lockdown.

Hay un spike escrito y listo para resolverlo —
`scratchpad/sonda.py` en el directorio temporal de la sesión de diseño— **que no se pudo
correr porque el cable del dueño no es de datos.** Queda pendiente.

**Consecuencia para el diseño, que es lo que importa:** estos dos campos se tratan igual
que cualquier otro campo del ingreso — se llenan solos si el equipo los entrega, y se
escriben a mano si no. El dueño ya lee el porcentaje de batería a mano hoy. No se
construye nada que se caiga si estos datos no llegan, y no se le muestra un error por
algo que el equipo simplemente no entrega.

**Esto no bloquea la planificación.** El diseño ya resuelve los dos escenarios; la sonda
solo decide cuántos campos se autocompletan. Córrela temprano, pero no esperes el cable
para planificar.

**Dato que va en la interfaz:** cuando el dueño instala una batería no original, iOS la
marca como pieza desconocida. Esa advertencia va a aparecer por su propio trabajo. Razón
de más para registrar el valor al ingreso: deja constancia de si ya venía marcado antes
de que él lo tocara.

### 8.4 La lectura nunca bloquea

Repetido acá porque es el anti objetivo principal. En la pantalla de ingreso:

- **Con equipo conectado:** los campos se llenan y se marcan como leídos por USB, con un
  enlace para editarlos a mano.
- **Sin equipo:** una franja ofrece **Reintentar** o **Cargar a mano**, y los campos
  quedan editables y vacíos. El ingreso se completa igual, incluso sin IMEI (§7.1).
- **Si el equipo enciende después:** un botón **Leer por USB** completa lo que falte
  **sin pisar lo que el dueño ya escribió a mano**, y si aparece un IMEI con historia,
  ofrece vincular.

---

## 9. Las pantallas y el flujo

Validado contra mockups con el dueño. Los mockups están en
`.superpowers/brainstorm/1597-1793190268/content/`.

### 9.1 Ingreso — una sola pantalla

De arriba a abajo:

1. **Franja de aviso, solo si ese IMEI ya pasó por el taller.** Dice el número de ficha
   anterior, qué se le hizo y cuándo, con un botón para abrir esa ficha. **Es un aviso,
   no un desvío:** el dueño fue explícito en que igual tiene que ingresar el equipo de
   nuevo. No preguntar si quiere continuar, no bifurcar el flujo.
2. **Datos del equipo**, con el indicador de origen (leído por USB / a mano) y el enlace
   para editar.
3. **Checklist de ingreso** (§9.4).
4. **Qué pidió el cliente**, y quién lo trajo.
5. **Observación general del ingreso.**
6. Guardar. La ficha queda `en_taller`.

**No hay comprobante impreso al ingreso.** Se le preguntó al dueño y fue claro: *"nada,
me lo pasan nomás, me dicen cámbiale la batería, al ingreso nada"*. El checklist de
ingreso se guarda en el sistema y aparece impreso recién en el voucher final, al lado
del de salida. No construir una segunda plantilla de impresión.

### 9.2 Reparación

- **Trabajos realizados**, selección múltiple: batería, pantalla, parlante, auricular,
  cámara trasera, cámara frontal, puerto de carga, vibrador, botones, vidrio trasero,
  otro (con texto). Lista corta porque hoy hace casi solo cambios de pieza.
- **Nota de la reparación**, texto libre, para imprevistos y detalles. **No se imprime
  en el voucher** (§9.6): es nota de taller, para él.

Sin repuestos, sin costos, sin tiempos.

*Esta sección es decisión mía: al preguntarle qué quería que quedara escrito de lo que
le hizo al equipo, respondió "lo demás good" sin especificar. Es lo primero que debería
revisar.*

### 9.3 Salida

- Vuelve a leer el equipo por USB si se puede, y **compara contra lo que se guardó al
  ingreso**. La comparación que importa es la de batería: de 79 % / 743 ciclos a 100 % /
  0 ciclos es la prueba del trabajo.
- **Checklist de salida**: las mismas líneas que el de ingreso, para poder poner los dos
  lado a lado.
- Observación general de salida.
- Cerrar. La ficha pasa a `entregado` (o `entregado_sin_reparar`) y queda congelada.

### 9.4 El checklist

Dos bloques. Esta lista la dio y la depuró el dueño.

**Funcionamiento** — estados: **Bien / Falla / No probado**

Pantalla y táctil · True Tone · Face ID · Cámara trasera · Cámara frontal · Parlante ·
Auricular · Micrófonos · Carga · Botones · Vibrador · Wi-Fi y señal · Sensor de
proximidad

Los tres estados son a propósito y el dueño los aceptó con la razón dada: con un solo
tilde no se distingue "lo probé y falla" de "no lo pude probar", y esa diferencia es
justo la que lo cubre cuando el cliente vuelve. En un equipo que llega apagado, casi todo
queda **No probado**, y eso es información, no un formulario incompleto.

**Condición y antecedentes** — cada línea con sus propios estados, porque no son cosas
que funcionen o no, son cosas que *están así*. El dueño pidió explícitamente que estas
cuatro fueran estado y no Bien/Falla:

| Línea | Estados |
|---|---|
| Apertura previa | Sin señales / Con señales |
| Indicador de humedad | Sin indicio / Activado |
| Vidrio trasero | Sano / Rayado / Trizado |
| Chasis | Sano / Golpes / Doblado |

**Toda línea, de los dos bloques, acepta una nota opcional.** Pedido del dueño. Las
notas escritas quedan visibles; las vacías no ocupan espacio. Además, una **observación
general** por checklist.

**Al constructor:** las líneas del checklist y sus estados van a cambiar con el tiempo
(el dueño ya dijo "quizás debo revisar más cosas"). Deben ser datos, no código, y una
ficha vieja tiene que seguir mostrándose con las líneas que tenía cuando se llenó, no
con las de hoy.

### 9.5 Inicio y búsqueda

*Esta pantalla faltaba por completo en la primera versión del documento; la detectó el
constructor que lo revisó. El diseño es decisión mía.*

Lo primero que ve al abrir la app:

- **Equipos en taller**, arriba y destacados. Es la pregunta que tiene todos los días:
  qué hay en la mesa.
- **Últimas fichas entregadas**, debajo.
- **Un buscador** que entra por número de ficha, IMEI, número de serie, modelo y **quién
  lo trajo**. Incluir "quién lo trajo" aunque no exista entidad cliente: escribir un
  nombre y encontrar el equipo es un reflejo natural y cuesta casi nada.

### 9.6 Voucher

Decisión mía: **el voucher es una página HTML con hoja de estilos de impresión**, no un
PDF generado por librería. El dueño imprime o guarda como PDF desde el navegador.

Por qué: la dirección visual elegida es de papel (§10), así que la pantalla y el papel
quieren verse igual. Con una hoja de impresión, lo que ve es lo que sale, y no hay una
librería de PDF que mantener ni una segunda plantilla que se desincronice.

**Lo que lleva impreso:**

- Datos de **AFIX**: nombre, teléfono, dirección y logo. *El dueño eligió esto
  explícitamente.*
- Número de ficha, fecha de ingreso y de entrega.
- Datos del equipo.
- **Los dos checklists, lado a lado** — ingreso y salida.
- El antes y después de batería.
- Trabajos realizados.
- Las observaciones generales de ingreso y salida.

**Lo que NO lleva**, porque se le ofreció y no lo eligió:

- Texto de garantía.
- Lo que pidió el cliente (se guarda en la ficha, no se imprime).
- La nota de reparación (es nota de taller, para él).

**El logo.** El dueño tiene el logo de AFIX pero no pudo adjuntarlo durante el diseño.
Tratamiento: **un archivo estático en el proyecto**, con su ruta en `ajustes_taller`. No
es un sistema de subida de imágenes, y no contradice el "sin fotos" de §3 — es un
archivo, una vez, no una imagen por ficha. El voucher tiene que imprimirse bien **sin el
logo** mientras no exista, dejando el nombre AFIX en texto. **Pedirle el archivo al
dueño antes de maquetar el voucher.**

**Hace falta una pantalla de ajustes** para cargar nombre, teléfono, dirección y logo una
sola vez. No existía en el diseño; aparece porque eligió los datos de taller.

---

## 10. Dirección visual — "Pauta de taller"

Elegida por el dueño entre tres direcciones completas presentadas en mockup. Las otras
dos eran "Instrumento de banco" (grafito, números grandes, estética de fuente de poder) y
"Despiece" (diagrama del equipo con piezas numeradas).

**De dónde sale:** la orden de trabajo en papel. Campos preimpresos sobre línea,
casillas, timbre de goma. Lo que ya conoce.

| Rol | Hex |
|---|---|
| Fondo (papel de talonario) | `#E8EDE9` |
| Fondo de campo | `#DCE4DE` |
| Línea y texto base | `#1F2A24` |
| Tinta de valores (lápiz pasta) | `#16314A` |
| Timbre / falla / alerta | `#A8322B` |
| Texto secundario | `#5E6B64` |

**Tipografía:** `Archivo Narrow` para etiquetas de campo y el timbre; `Archivo` para
valores y texto corrido. Una sola familia en dos anchos.

**Gestos de la dirección:**

- Los campos son **etiqueta chica sobre línea inferior**, como un formulario preimpreso.
  No cajas con borde completo.
- El número de ficha es un **timbre de goma**: caja de borde grueso rojo, levemente
  rotada.
- Un solo color de señal, el rojo del timbre, para falla y alerta. Nada más grita.

**Deudas conocidas de los mockups, a no copiar tal cual:** los wireframes tempranos
usaban etiquetas en MAYÚSCULAS, cadenas unidas con puntos medios (`A · B · C`) y flechas
en los botones. Son tics genéricos; el informe visual final ya los dejó atrás. Etiquetas
en caja de oración, botones que dicen qué hacen, sin flecha.

**Piso de calidad, sin anunciarlo:** responsive hasta ancho de teléfono, foco visible con
teclado, `prefers-reduced-motion` respetado, contraste suficiente.

---

## 11. Cómo se construye

Decisiones mías. El dueño dijo que no tiene preferencia de stack y preguntó qué conviene;
sí definió que el código va a GitHub y que los datos tienen que sobrevivir a la pérdida
del PC.

- **App web que corre en el PC del dueño.** Abre en `localhost` y se ve como una web
  normal. No es una app de escritorio empaquetada: hay que correr un comando, y eso es
  aceptable porque ya tiene que levantar el servicio USB igual.
- **Next.js + TypeScript.**
- **Postgres gestionado en el plan gratuito de Supabase.** Elegido por el dueño: ya tiene
  el CLI instalado y lo prefiere a las alternativas. Sin fotos, los datos son texto; el
  plan gratuito sobra con margen enorme. Esto es lo que hace que clonar el repo en otra
  máquina muestre el historial completo. El ORM queda a criterio del constructor.
  - Usá el **CLI de Supabase para las migraciones**, versionadas en el repo. Es la razón
    práctica por la que conviene Supabase acá: el esquema viaja con el código.
  - No se usan Auth, Storage ni Realtime. No hay login (§11) y no hay archivos por ficha
    (§3). Es Postgres y nada más.
  - `supabase start` levanta una base local en Docker. Si el dueño no tiene Docker, el
    desarrollo va directo contra la base hospedada; no instales Docker por esto sin
    preguntarle.
- **Servicio USB local en Python + FastAPI**, envolviendo pymobiledevice3, en su propio
  venv en ruta corta.
- **Voucher por hoja de estilos de impresión**, sin librería de PDF.
- **Un solo comando** que levante la web y el servicio USB juntos. El dueño no debería
  tener que acordarse de dos.
- **Solo el PC del banco de trabajo.** Decisión mía: el servidor escucha en `localhost`,
  no se expone a la red local, y no hay acceso desde el teléfono. No hay login por
  diseño, así que exponerlo a la red sería publicar el historial a quien esté en el
  Wi-Fi. El trabajo responsive del piso de calidad queda como higiene, no como caso de
  uso.

### 11.1 Que el respaldo exista de verdad

El objetivo "sobrevive a la muerte del PC" descansa en la base en la nube, y eso tiene
dos agujeros que el constructor que revisó el documento encontró. Los dos son mi
decisión:

1. **La credencial.** Si la única copia de la `DATABASE_URL` y de la sesión de Supabase
   vive en el PC que se perdió, el respaldo no existe. **El proyecto de Supabase lo crea
   el dueño con su propio correo, y la credencial queda anotada fuera del PC** (gestor de
   contraseñas o donde él guarde sus claves). Es un paso de puesta en marcha, y va en el
   README, porque es el único motivo por el que se eligió la nube.
2. **El plan gratuito de Supabase pausa los proyectos inactivos.** Dos medidas, las dos
   pedidas o aprobadas por el dueño:
   - **Un ping periódico** que mantenga el proyecto despierto. Una consulta trivial
     bastante más seguida que el plazo de inactividad. **Tiene que correr en la nube, no
     en el PC del dueño** — si corre en el PC, deja de latir justo en el escenario del
     que esto nos protege (el PC murió o está apagado una semana). Un cron gratuito de
     GitHub Actions sobre el mismo repo alcanza.
   - **Una función de exportar respaldo**: un archivo que el dueño pueda bajar y guardar
     donde quiera. **El ping no la reemplaza.** El ping evita que el proyecto se pause;
     no protege contra perder la cuenta, un borrado accidental ni un cambio de política
     del plan gratuito. Chica, pero no opcional.

**Riesgo a nombrar:** la base en la nube implica que sin internet no hay app. Para un
taller es aceptable y es el precio de que el historial no se muera con el PC, que es el
miedo declarado. Si resulta molesto en la práctica, la alternativa es base local con
respaldo automático a la nube, que trae su propio problema de sincronización. **No lo
construyas por adelantado.**

---

## 12. Qué queda a criterio del constructor

- Estructura de carpetas, ORM, estrategia de migraciones.
- Cómo se corre todo con un comando en Windows.
- Forma exacta del endpoint del servicio USB y su manejo de errores.
- Cómo se guarda el checklist (el requisito es el de §9.4: datos, no código, y las fichas
  viejas conservan sus líneas).
- Tabla de equivalencias `ProductType` → modelo comercial, y de dónde sacarla.
- Mecánica de la vinculación de equipos de §7.1 (cuándo se ofrece, cómo se confirma).
- Formato del archivo de respaldo exportable.
- Estrategia de pruebas. El servicio USB no se puede probar sin un iPhone enchufado, así
  que tiene que poder simularse.
- Numeración de fichas (correlativo, de dónde sale, qué pasa con los huecos).
- Formato de fechas y locale.
- Qué campos extra del lockdown (nombre del equipo, MACs, región) se guardan y cuáles no.

## 13. Lo primero que hay que hacer

1. **Planificar.** El diseño está cerrado; no hay nada esperando.
2. **Correr la sonda con un cable de datos, temprano**, y cerrar §8.3. No bloquea el
   plan: decide cuántos campos se autocompletan y cuántos van a mano.
3. **Pedirle a Álvaro el archivo del logo de AFIX** antes de maquetar el voucher.
4. Agregar `.superpowers/` al `.gitignore`. Ahí quedan los mockups de la sesión de
   diseño: útiles de consultar, pero no son código.
