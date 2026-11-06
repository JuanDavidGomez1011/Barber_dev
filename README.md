# Barbería · Reservas en línea

Sistema web para que una barbería reciba citas por internet. Los clientes reservan desde el celular en menos de un minuto y sin crear cuenta; los barberos llevan su agenda del día; el dueño administra servicios, horarios, equipo y ve cómo va el negocio.

Pensado para Colombia: en español, precios en pesos colombianos y hora de Bogotá.

## Qué hace

### Para los clientes

- **Ver la carta de servicios** con precio y duración, y conocer al equipo.
- **Reservar en cuatro pasos:** servicio → barbero (o "cualquiera disponible") → día y hora → nombre y WhatsApp.
- **Solo ve horarios realmente libres:** se calculan con el turno de cada barbero, el horario del local, las citas ya tomadas, los bloqueos y los festivos.
- **Gestionar su cita con un enlace único:** ver el comprobante, cambiar la hora, cancelar (hasta unas horas antes, según lo que defina la barbería) o agregarla a Google Calendar.
- **Recibir avisos por WhatsApp:** confirmación al reservar, recordatorios 24 h y 2 h antes, y aviso si la cita cambia o se cancela.

### Para los barberos

- **Agenda del día y de la semana**, con el contacto de WhatsApp de cada cliente.
- **Marcar cada cita** como atendida o como "no asistió".
- **Bloquear horarios** (almuerzo, permisos, capacitaciones) un día, todo el día o repetidos en sus días de trabajo.

### Para el dueño

- **Resumen del negocio:** ingresos estimados de la semana, citas de hoy, tasa de inasistencia, citas por día y servicios más pedidos.
- **Citas:** lista con filtros por fecha, barbero, estado o cliente; cambiar estados o cancelar con motivo.
- **Calendario del día** con una columna por barbero.
- **Servicios, barberos y horarios:** precios, duraciones, qué servicios presta cada barbero, turnos semanales (también partidos), horario del local y días festivos.
- **Ajustes:** datos del negocio y reglas de reserva (anticipación mínima, límite para cancelar o cambiar, intervalo entre horarios y cuántos días hacia adelante se puede reservar).
- **Notificaciones:** ver qué mensajes se enviaron, cuáles fallaron y reintentarlos.

### Confiabilidad

- **Sin citas cruzadas:** aunque dos personas reserven el mismo horario al mismo tiempo, solo una lo obtiene; la otra recibe un aviso para elegir otro.
- **Límite de citas por número** y protección contra bots en el formulario.
- **Acceso del equipo protegido** con sesión segura y bloqueo ante intentos repetidos de contraseña.

## Tecnología

Next.js (App Router) · React · TypeScript · Tailwind CSS · PostgreSQL (Supabase) · Prisma · Zod · Vitest

Las notificaciones funcionan con Twilio o con la API de WhatsApp Business de Meta; sin proveedor configurado, los mensajes se simulan en los registros del servidor.

## Puesta en marcha

Requisitos: Node.js 20.19 o superior y una base de datos PostgreSQL (por ejemplo, un proyecto gratuito de [Supabase](https://supabase.com)).

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` como `.env` y completa los valores. Cada variable está explicada en ese archivo. **Nunca subas tu `.env` al repositorio.**
3. Crea las tablas:
   ```bash
   npm run db:migrate
   ```
4. (Solo desarrollo) Carga datos de ejemplo. Usa la contraseña que definas en `SEED_PASSWORD`; el comando no borra una base que ya tenga usuarios reales.
   ```bash
   npm run db:seed
   ```
5. Arranca la app en http://localhost:3000:
   ```bash
   npm run dev
   ```

### Producción

1. Usa una base de datos distinta a la de desarrollo y prepárala sin datos de ejemplo:
   ```bash
   npm run db:deploy
   npm run db:bootstrap
   npm run admin:create -- --email tu-correo@dominio.com --name "Tu nombre"
   ```
2. Publica la app (Render, Vercel u otro servicio de Node.js) con las mismas variables de `.env.example`, usando **secretos nuevos** generados para producción.
3. Los recordatorios necesitan que alguien llame a la app cada 5 minutos. El repositorio trae un flujo de GitHub Actions que lo hace: basta con definir los secretos `APP_URL` y `CRON_SECRET` en GitHub.
4. Entra al panel de administración y configura servicios, barberos, horarios y los datos del negocio.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia la app en modo desarrollo |
| `npm run build` / `npm start` | Compila y ejecuta la versión de producción |
| `npm test` | Corre las pruebas automáticas |
| `npm run typecheck` · `npm run lint` | Revisa tipos y estilo del código |
| `npm run db:migrate` | Crea o aplica cambios de la base en desarrollo |
| `npm run db:deploy` | Aplica los cambios de la base en producción |
| `npm run db:seed` | Carga datos de ejemplo (solo desarrollo) |
| `npm run db:bootstrap` | Prepara una base nueva con la configuración inicial |
| `npm run admin:create` | Crea o actualiza un administrador |
| `npm run db:studio` | Abre un explorador visual de la base |
