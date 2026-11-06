# Sistema de reservas — Barbería

Reservas web para una barbería: los clientes reservan desde el celular sin crear cuenta, los barberos gestionan su agenda y el dueño administra servicios, horarios y métricas.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · PostgreSQL (Supabase) · Prisma 7 · Zod · Vitest
**Configuración regional:** español · pesos colombianos (COP) · `America/Bogota`

> Estado: **las 5 fases completas**: modelo de datos, reservas, panel del barbero, panel de administración y notificaciones por WhatsApp (simuladas hasta conectar un proveedor).

## Requisitos

- Node.js 20.19+ (probado con 24)
- Un proyecto de [Supabase](https://supabase.com) (el plan gratuito alcanza). La base de datos corre en la nube, no en tu equipo.

## Crear la base de datos en Supabase

1. En [supabase.com/dashboard](https://supabase.com/dashboard) crea un proyecto nuevo. Elige una contraseña de base de datos y guárdala. Región recomendada para Colombia: **East US (North Virginia)**, la más cercana.
2. Cuando termine de crearse, pulsa **Connect** (arriba en el panel) y copia las cadenas de conexión del pooler:
   - **Transaction pooler** (puerto `6543`) → `DATABASE_URL`
   - **Session pooler** (puerto `5432`) → `DIRECT_URL`
3. Pégalas en `.env` y reemplaza `[YOUR-PASSWORD]` por tu contraseña.

> Recomendación: usa **un proyecto para desarrollo** y **otro para producción** (el plan gratuito permite dos), así el seed nunca toca datos reales. Los proyectos gratuitos se pausan tras 7 días sin uso; se reactivan desde el panel.

## Correr en local

```bash
npm install                 # también genera el cliente de Prisma
cp .env.example .env        # en Windows: copy .env.example .env  → luego pega tus URLs de Supabase
npm run db:migrate          # aplica las migraciones en Supabase
npm run db:seed             # datos de ejemplo
npm run dev                 # http://localhost:3000
```

Explorar los datos: `npm run db:studio`. Borrar todo y volver a sembrar: `npm run db:reset`.

### Usuarios de ejemplo

Contraseña de todos: el valor de `SEED_PASSWORD` en `.env` (por defecto `barberia123`).

| Rol | Correo |
|---|---|
| Administrador | `admin@barberia.local` |
| Barbero | `carlos@barberia.local`, `andres@barberia.local`, `miguel@barberia.local` |

## Modelo de datos

Definido en [`prisma/schema.prisma`](prisma/schema.prisma).

- **Instantes en UTC** (`timestamptz`): citas, bloqueos y notificaciones.
- **Horarios semanales en minutos desde medianoche**, hora de Bogotá (`540` = 09:00).
- **Dinero en pesos enteros** (`priceCop`). La cita guarda una copia del precio y la duración al reservar.
- **Reglas configurables** en `BusinessSettings`: anticipación mínima (120 min), límite para cancelar o reprogramar (180 min), intervalo de horarios (15 min) y días hacia adelante para reservar (30).
- **Enlace de gestión**: en la base de datos solo se guarda el SHA-256 del token; el token en claro solo va en el enlace que recibe el cliente.

### Protección contra citas cruzadas

La migración inicial agrega una restricción de exclusión de PostgreSQL:

```sql
EXCLUDE USING gist ("barberId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" IN ('CONFIRMED', 'COMPLETED'))
```

La base de datos rechaza cualquier par de citas activas del mismo barbero que se crucen, aunque lleguen dos peticiones en el mismo instante. La lógica de reserva de la fase 2 valida antes de insertar y traduce este error a un mensaje claro ("ese horario se acaba de ocupar").

## Flujo de reserva (cliente)

| Ruta | Qué hace |
|---|---|
| `/` | Servicios con precio y duración, y el equipo |
| `/reservar` | Asistente en 4 pasos: servicio → barbero (o "cualquiera disponible") → fecha y hora → datos |
| `/cita/[token]` | Confirmación con enlace único: cancelar, reprogramar, agregar a Google Calendar |
| `GET /api/availability` | Horarios disponibles por día (`serviceId`, `barberId=any\|<id>`, `from`, `days`) |

**Cómo se calculan los horarios** ([`compute-slots.ts`](src/lib/availability/compute-slots.ts), función pura con tests): turnos del barbero ∩ horario del local, en intervalos de 15 min alineados al reloj, donde el servicio completo cabe sin cruzarse con citas ni bloqueos, a partir de *ahora + 2 h*. Festivos y días cerrados no tienen horarios.

**Cómo se evita la doble reserva** ([`booking.service.ts`](src/server/services/booking.service.ts)):
1. Transacción con `pg_advisory_xact_lock` por barbero: las reservas simultáneas al mismo barbero se atienden en fila.
2. Dentro de la transacción se recalcula la disponibilidad con datos frescos.
3. La restricción `EXCLUDE` de la base de datos es la última barrera.
4. Con "cualquiera disponible" se prueba primero el barbero con menos citas ese día y, si ya lo tomaron, el siguiente.

Otras reglas: máximo 3 citas futuras por número de WhatsApp, cancelar o reprogramar hasta 3 h antes, campo trampa contra bots y validación con Zod en cliente y servidor.

### Probarlo

1. `npm run dev` y abre http://localhost:3000 (en el navegador, modo celular con F12).
2. Reserva una cita: al terminar llegas a `/cita/<token>?nueva=1`.
3. Desde esa página, reprograma y cancela.
4. Enlace de ejemplo del seed: http://localhost:3000/cita/demo-cita-ejemplo
5. Prueba de concurrencia contra la base real: `npm run test:race` (lanza 6 reservas simultáneas al mismo horario; solo debe entrar 1).

## Panel del barbero

Entra en http://localhost:3000/login con un usuario barbero (ver [Usuarios de ejemplo](#usuarios-de-ejemplo)).

| Ruta | Qué hace |
|---|---|
| `/barbero` | Agenda del día: citas y bloqueos en orden, totales, enlace a WhatsApp del cliente. Marcar **completada** / **no asistió** (cuando la cita ya empezó) o **deshacer** |
| `/barbero/semana` | Vista de lunes a domingo; cada día lleva a su agenda |
| `/barbero/bloqueos` | Bloquear horarios (almuerzo, permisos), un día, todo el día o repetido en los días de trabajo (hasta 60 días). Si se cruza con citas confirmadas, no se crea y se listan los cruces |

**Autenticación** ([`src/server/auth`](src/server/auth)): cookie de sesión firmada (JWT con `jose`, `httpOnly`, 7 días). [`proxy.ts`](src/proxy.ts) solo redirige rápido según la cookie; cada página y acción verifica de nuevo con `requireBarber()` / `requireAdmin()`, que consulta que el usuario siga activo. Un barbero solo puede ver y modificar sus propias citas y bloqueos.

## Panel de administración

Entra con `admin@barberia.local` (en producción, crea tu propio admin: ver abajo).

| Ruta | Qué hace |
|---|---|
| `/admin` | Resumen: ingresos estimados de la semana, citas de hoy, tasa de inasistencia (30 días), citas por día y servicios más pedidos |
| `/admin/citas` | Lista con filtros (fechas, barbero, estado, cliente por nombre o teléfono) y paginación. Marcar estados o cancelar con motivo |
| `/admin/calendario` | Vista del día con una columna por barbero: turnos, citas y bloqueos |
| `/admin/servicios` | Crear, editar, ocultar o borrar servicios (los que tienen historial solo se ocultan) |
| `/admin/barberos` | Crear barberos con su acceso, servicios que prestan, horario semanal (turnos partidos) y contraseña |
| `/admin/horarios` | Horario de atención del local y festivos / días cerrados (avisa si ese día hay citas) |
| `/admin/ajustes` | Nombre, ciudad, dirección y WhatsApp del negocio; reglas de reserva (anticipación, límite para cancelar, intervalo, días hacia adelante) |

Las métricas del resumen se calculan en una función pura con tests ([`stats.ts`](src/lib/dashboard/stats.ts)). Al editar servicios, barberos o ajustes se invalida la caché del catálogo público (`updateTag`), así que el sitio muestra los cambios de inmediato.

### Crear el administrador real

```bash
npm run admin:create -- --email dueno@tubarberia.com --name "Tu nombre"
```

Si defines `ADMIN_PASSWORD` se usa esa contraseña; si no, se genera una y se muestra una sola vez.

## Notificaciones por WhatsApp

| Evento | Mensaje |
|---|---|
| Reserva | Confirmación inmediata con el enlace para cancelar o reprogramar |
| 24 h y 2 h antes | Recordatorios (se omiten si saldrían casi junto con la confirmación) |
| Reprogramación | Aviso inmediato; los recordatorios se recalculan para la nueva hora |
| Cancelación (cliente o barbería) | Aviso inmediato; los recordatorios pendientes se descartan |

**Cómo funciona** ([`src/server/notifications`](src/server/notifications)):

- Cada evento deja filas en la tabla `Notification` (una por cita y tipo). Los mensajes inmediatos se envían justo después de responder al usuario (`after()`); los recordatorios y reintentos los envía el cron.
- El envío **reclama** cada notificación con `FOR UPDATE SKIP LOCKED`: aunque el cron y un envío inmediato coincidan, ningún mensaje sale dos veces (`npm run test:notifications-race`).
- Errores temporales se reintentan (5 y 10 min después, hasta 3 intentos); los mensajes que ya no tienen sentido (cita cancelada, recordatorio atrasado) se descartan.
- Los recordatorios incluyen el enlace de gestión: la cita guarda una **copia cifrada** del token (AES-256-GCM, clave `TOKEN_SECRET`/`SESSION_SECRET`); en la base nunca está el token en claro.
- Panel: **Admin → Notificaciones** muestra la cola, el texto de cada mensaje, errores, reintentos y un botón para enviar los pendientes ya.
- Textos: [`src/lib/notifications/templates.ts`](src/lib/notifications/templates.ts).

**Proveedor** (`NOTIFICATIONS_PROVIDER`):

| Valor | Qué hace |
|---|---|
| `console` (por defecto) | Simulado: escribe cada mensaje en los logs del servidor |
| `twilio` | Twilio WhatsApp. Variables `TWILIO_*` (ver `.env.example`). Texto libre en el sandbox; en producción, plantillas con `TWILIO_CONTENT_SID_<TIPO>` |
| `whatsapp-cloud` | API oficial de Meta. Variables `WHATSAPP_*`. Requiere plantillas aprobadas por Meta (una por tipo de mensaje, con las variables `{{1}}`, `{{2}}`… en el orden que entrega `templates.ts`) |

Para agregar otro proveedor: implementa la interfaz `NotificationProvider` ([`provider.ts`](src/server/notifications/provider.ts)) y regístrala en [`index.ts`](src/server/notifications/index.ts).

**Cron cada 5 minutos.** `GET /api/cron/notifications` con el encabezado `Authorization: Bearer <CRON_SECRET>`. El cron de Vercel en el plan Hobby solo corre una vez al día, así que el repo trae [`.github/workflows/notifications-cron.yml`](.github/workflows/notifications-cron.yml): define en GitHub los secretos `APP_URL` y `CRON_SECRET` y empieza a correr solo. Alternativa más puntual: [cron-job.org](https://cron-job.org) con la misma URL y encabezado. En local puedes llamarlo a mano: `curl http://localhost:3000/api/cron/notifications`.

## Despliegue (Vercel + Supabase)

1. Crea el proyecto de producción en Supabase y copia sus dos URLs, igual que en [Crear la base de datos](#crear-la-base-de-datos-en-supabase).
2. Con esas variables en `.env`, prepara la base (sin datos de ejemplo; **no corras el seed en producción**, borra todo):
   ```bash
   npm run db:deploy        # crea las tablas
   npm run db:bootstrap     # ajustes y horario del local
   npm run admin:create -- --email dueno@tubarberia.com --name "Tu nombre"
   ```
   Luego entra a `/admin` y crea servicios, barberos y horarios.
3. Importa el repositorio en Vercel y define las mismas variables de entorno: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` y `CRON_SECRET` (genera valores nuevos para producción), `APP_URL` con tu dominio, y las del proveedor de WhatsApp cuando lo conectes.
4. En GitHub, agrega los secretos `APP_URL` y `CRON_SECRET` para activar el cron de recordatorios.
5. Elige la región de Supabase más cercana a tus usuarios y a la región de funciones de Vercel (para Colombia: `us-east-1`). Cada conexión nueva a una región lejana tarda casi un segundo.

## Scripts

| Script | Qué hace |
|---|---|
| `db:migrate` | Crea o aplica migraciones en desarrollo |
| `db:deploy` | Aplica migraciones en producción |
| `db:seed` | Carga los datos de ejemplo (borra los existentes) |
| `db:reset` | Borra la base, migra y siembra |
| `db:studio` | Abre Prisma Studio |
| `test` | Corre los tests (Vitest) |
| `test:race` | Prueba de reservas simultáneas contra la base de datos de `.env` |
| `admin:create` | Crea o actualiza un usuario administrador |
| `test:notifications-race` | Prueba que el envío concurrente no duplica mensajes (base de `.env`) |
| `db:bootstrap` | Prepara una base nueva con los ajustes y el horario del local (no borra nada) |
| `typecheck` | Revisa los tipos con TypeScript |
