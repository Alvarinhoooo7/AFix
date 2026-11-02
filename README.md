# AFIX — Plataforma de servicio técnico

Sistema del taller **AFIX** para iPhone e iPad: lectura por USB (más completa que 3uTools), fichas numeradas, inspección con checklist versionado, antecedentes de estabilidad leídos del propio iPhone, comprobante de ingreso e informe de entrega en PDF archivados en Supabase Storage, y respaldo exportable.

---

## 1. Uso diario

Doble clic en el acceso directo **AFix** del escritorio, o en una terminal:

```bash
npm run taller
```

Levanta el **agente USB** (`127.0.0.1:8765`) y la app (`127.0.0.1:3000`), y abre el navegador. La primera vez, y después de cada actualización del código, compila la app antes de arrancar. Si el agente no está, la app funciona igual en modo manual. Si AFix ya está abierto, solo abre el navegador. Para cerrarlo, cierra la ventana «AFix» de la barra de tareas.

Para volver a crear el acceso directo (por ejemplo, en un PC nuevo), apunta uno a `scripts\AFix.cmd` con el ícono `public\marcafix.ico`.

El flujo:

1. **Recepción.** Conecta el iPhone con un cable de datos. En el panel aparece la tarjeta «Equipo conectado». Desde ahí, **Nuevo ingreso**, que tiene 4 pasos: Equipo (lectura USB), Inspección, Cliente y Revisar y emitir. Al emitir se genera el **comprobante de ingreso** en PDF.
2. **Taller.** En la ficha: Pasar a reparación → Guardar reparación (trabajos y piezas) → Marcar listo.
3. **Entrega.** Entregar → lectura de salida (comparación de piezas, batería y fallas nuevas) → checklist de salida con **vigilancia en vivo** → **informe de entrega** en PDF. La ficha queda congelada.

Cada documento se puede ver dentro de la web, descargar, compartir (hoja de compartir de Windows) o enviar por WhatsApp.

### Lo que lee el USB

Identidad (modelo, número de modelo, IMEI, serie, ECID, UDID), iOS, **Buscar mi iPhone** (con la cuenta iCloud enmascarada), activación, batería (salud en mAh, ciclos), cargador conectado, almacenamiento, operador y SIM, series de piezas, reloj del iPhone y los **registros del equipo**: pánicos del kernel con su causa probable, reinicios forzados (el equipo quedó pegado), bloqueos de sistema y faltas de memoria, con fecha y hora. Nunca se borra nada del iPhone. El USB nunca marca una línea del checklist como «Bien»: solo sugiere «Falla» cuando hay evidencia.

Las reglas que traducen los pánicos están en `agente/afix_usb/reglas_panicos.json`. Se pueden agregar casos sin tocar el código.

---

## 2. Dónde vive la credencial (recuperación ante pérdida del PC)

El objetivo de usar Postgres en Supabase es que **el historial sobreviva si el PC del taller muere o se reemplaza**. Para que eso sea real:

1. El proyecto de Supabase está creado con el correo personal del dueño.
2. La cadena de conexión (`DATABASE_URL`), la clave de servicio de Storage (`SUPABASE_SERVICE_ROLE_KEY`) y la clave de la cuenta de Supabase **deben estar guardadas fuera del PC del taller**, en el gestor de contraseñas personal del dueño.
3. En GitHub (`Settings` → `Secrets and variables` → `Actions`), la misma `DATABASE_URL` se guarda como el secreto `DATABASE_URL`. Así el flujo `.github/workflows/keepalive.yml` hace una consulta cada 3 días y evita que el plan gratuito de Supabase se pause.

---

## 3. Puesta en marcha en una máquina nueva

1. **Clonar e instalar:**
   ```bash
   git clone <url-del-repositorio>
   cd afix
   npm install
   ```
2. **Variables de entorno:** copia `.env.example` a `.env.local` y completa:
   - `DATABASE_URL`: la de Supabase en la nube.
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: para archivar los PDF. Están en Supabase → Project Settings → API. Sin ellas la app funciona, pero no puede emitir documentos.
3. **Migraciones:** aplica las que falten a la base de Supabase (crean también el bucket privado `documentos`):
   ```bash
   supabase migration up --db-url "<tu-DATABASE_URL>"
   ```
4. **Agente USB** (Python 3.12 y el servicio de Apple, que viene con iTunes o Dispositivos Apple):
   ```powershell
   python -m venv C:\afix-usb\venv
   C:\afix-usb\venv\Scripts\python.exe -m pip install -e "agente[pruebas]"
   ```
   Si el venv va en otra ruta, defínela en la variable `AGENTE_PYTHON`.
5. **Arrancar:** `npm run taller`. Todo escucha solo en `127.0.0.1`, para no exponer el historial en la red Wi-Fi.

---

## 4. Respaldo descargable

Desde **Ajustes → Descargar respaldo** (`/api/respaldo`) se descarga `respaldo-afix-AAAA-MM-DD.zip` con:

- `respaldo.json`: equipos, fichas, notas posteriores, registros del equipo, documentos emitidos (con su huella `sha256`), datos del taller y todas las versiones del checklist y de las cláusulas.
- `documentos/`: los PDF emitidos, tal como se enviaron. Si alguno no se pudo bajar, queda anotado en `faltantes.txt`.

---

## 5. Desarrollo y pruebas

Consulta [`docs/desarrollo.md`](docs/desarrollo.md) para el entorno local con Docker y Supabase CLI.

- `npm test`: pruebas de la app (vitest). Requieren `supabase start` y `TEST_DATABASE_URL` hacia una base cuyo nombre termine en `_test`. Los PDF de prueba van a una carpeta temporal (`ALMACEN_DIRECTORIO`), nunca a Storage.
- `npm run test:agente`: pruebas del agente USB (pytest) con fixtures, sin equipo conectado.
- **Sonda:** `cd agente; C:\afix-usb\venv\Scripts\python.exe -m afix_usb.sonda salida.json --anonimo` vuelca todo lo que entrega el iPhone conectado, con IMEI, series y cuenta reemplazados. Sirve para sumar fixtures en `agente/pruebas/fixtures/`.
- **La base local nunca debe contener datos reales de clientes**: el stack de Supabase publica sus puertos en `0.0.0.0` con la contraseña por omisión.
