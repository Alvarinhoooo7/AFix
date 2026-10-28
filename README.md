# AFIX — Plataforma de servicio técnico

Sistema de registro de trabajos de reparación para el taller **AFIX**: fichas numeradas con timbre correlativo, checklist de ingreso y de salida versionado, reconocimiento de equipos que vuelven por IMEI, voucher imprimible en hoja carta y respaldo exportable.

---

## 1. Dónde vive la credencial (recuperación ante pérdida del PC)

El objetivo principal de usar Postgres en Supabase es que **el historial sobreviva si el PC del taller muere o se reemplaza**. Para que eso sea real:

1. El proyecto de Supabase está creado con el correo personal del dueño.
2. La cadena de conexión (`DATABASE_URL` de Supabase en la nube) y la clave de acceso a la cuenta de Supabase **deben estar guardadas fuera del PC del taller** (en el gestor de contraseñas personal del dueño o anotadas en su respaldo seguro fuera de la máquina).
3. En el repositorio de GitHub (`Settings` → `Secrets and variables` → `Actions`), la misma `DATABASE_URL` se guarda como el secreto `DATABASE_URL` para que el flujo `.github/workflows/keepalive.yml` haga una consulta cada 3 días desde la nube y evite que el plan gratuito de Supabase se pause por inactividad.

---

## 2. Puesta en marcha en una máquina nueva

Si cambias o formateas el PC, sigue estos pasos para recuperar todo el sistema y el historial:

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone <url-del-repositorio>
   cd "Servicio Tecnico"
   npm install
   ```

2. **Configurar las variables de entorno:**
   Copia `.env.example` a `.env.local` y pega la `DATABASE_URL` anotada en tu gestor de contraseñas:
   ```bash
   cp .env.example .env.local
   ```

3. **Aplicar las migraciones (solo si apuntas a una base recién creada):**
   Si la base en Supabase ya es la tuya en uso, el esquema y los datos ya están ahí. Si creaste una base nueva desde cero:
   ```bash
   supabase migration up --db-url "<tu-DATABASE_URL>"
   ```

4. **Arrancar la aplicación:**
   ```bash
   npm run dev
   ```
   Abre `http://127.0.0.1:3000`. El servidor escucha únicamente en `127.0.0.1` (`localhost`) para no exponer el historial en la red Wi-Fi.

---

## 3. Respaldo descargable

Además del ping automático en GitHub Actions, desde la pantalla de inicio puedes usar **Descargar respaldo** (`/api/respaldo`), que descarga un archivo `respaldo-afix-AAAA-MM-DD.json` con:

- Todos los equipos registrados (`equipos`)
- Todas las fichas (`fichas`) y sus notas posteriores (`notasPosteriores`)
- Los datos del taller (`ajustes`)
- Todas las versiones históricas del catálogo de checklist (`catalogos`) para que las fichas antiguas siempre puedan releerse con las etiquetas que tenían cuando se llenaron.

---

## 4. Desarrollo local y pruebas

Consulta [`docs/desarrollo.md`](docs/desarrollo.md) para los detalles del entorno local con Docker y Supabase CLI:

- `supabase start` levanta el Postgres local en Docker. **Importante:** el stack local de Supabase publica sus puertos en `0.0.0.0` con la contraseña de desarrollo por omisión, por lo que **la base local nunca debe contener datos reales de clientes** (los datos reales van en el proyecto de Supabase en la nube).
- `npm test` requiere el CLI de `supabase` en el `PATH`, el contenedor local corriendo (`supabase start`) y la variable `TEST_DATABASE_URL` apuntando a una base separada cuyo nombre termine en `_test` (por ejemplo `afix_test`).
