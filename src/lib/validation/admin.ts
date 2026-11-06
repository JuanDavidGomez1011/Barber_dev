import { z } from "zod";
import { normalizePhone } from "../phone";
import { parseTimeHHmm } from "../time";

/** Checkbox HTML: llega "on" si está marcado, ausente si no. */
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => v || null);
const int = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label}: escribe un número` })
    .int(`${label}: debe ser un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);
const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const time = (label: string) =>
  z
    .string()
    .refine((v) => parseTimeHHmm(v) !== null, `${label}: hora no válida`)
    .transform((v) => parseTimeHHmm(v)!);

// ------------------------------------------------------------------ servicios

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(60),
  description: optionalText(200),
  durationMin: int("Duración", 5, 480).refine((v) => v % 5 === 0, "La duración debe ser múltiplo de 5 minutos"),
  priceCop: int("Precio", 0, 10_000_000),
  sortOrder: int("Orden", 0, 999).default(0),
  active: checkbox,
});

// ------------------------------------------------------------------ barberos

const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(100);

export const barberSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(60),
  bio: optionalText(200),
  photoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null)
    .pipe(z.url("La foto debe ser una URL (https://…)").nullable()),
  email: z.email("Correo no válido").trim().toLowerCase(),
  sortOrder: int("Orden", 0, 999).default(0),
  active: checkbox,
  serviceIds: z.array(z.string().min(1).max(64)).default([]),
});

export const newBarberSchema = barberSchema.extend({ password });
export const passwordSchema = z.object({ password });

/** Turnos semanales: lista de {día, inicio, fin}; sin solapes dentro del mismo día. */
export const workingHoursSchema = z
  .array(
    z.object({
      dayOfWeek: z.coerce.number().int().min(0).max(6),
      start: time("Inicio"),
      end: time("Fin"),
    }),
  )
  .max(30)
  .superRefine((shifts, ctx) => {
    shifts.forEach((s, i) => {
      if (s.end <= s.start) ctx.addIssue({ code: "custom", message: "Cada turno debe terminar después de empezar", path: [i] });
    });
    for (let d = 0; d <= 6; d++) {
      const day = shifts.filter((s) => s.dayOfWeek === d).sort((a, b) => a.start - b.start);
      for (let i = 1; i < day.length; i++) {
        if (day[i].start < day[i - 1].end) ctx.addIssue({ code: "custom", message: "Hay turnos que se cruzan el mismo día" });
      }
    }
  });

// ------------------------------------------------------------------ local

export const businessHoursSchema = z
  .array(
    z.object({
      dayOfWeek: z.coerce.number().int().min(0).max(6),
      isClosed: z.boolean(),
      open: time("Apertura"),
      close: time("Cierre"),
    }),
  )
  .length(7)
  .superRefine((days, ctx) => {
    days.forEach((d, i) => {
      if (!d.isClosed && d.close <= d.open) {
        ctx.addIssue({ code: "custom", message: "El cierre debe ser después de la apertura", path: [i] });
      }
    });
  });

export const closedDaySchema = z.object({
  date: dateISO,
  reason: optionalText(80),
  /** Crear aunque haya citas confirmadas ese día. */
  force: checkbox,
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del negocio").max(80),
  city: z.string().trim().min(2, "Escribe la ciudad").max(80),
  address: optionalText(120),
  whatsapp: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const phone = normalizePhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "WhatsApp no válido. Ej: 300 123 4567" });
        return z.NEVER;
      }
      return phone;
    }),
  minLeadMinutes: int("Anticipación mínima", 0, 7 * 24 * 60),
  cancelLimitMinutes: int("Límite para cancelar", 0, 7 * 24 * 60),
  slotIntervalMinutes: z.coerce
    .number()
    .refine((v) => [5, 10, 15, 20, 30, 60].includes(v), "Intervalo no válido"),
  bookingHorizonDays: int("Días para reservar", 1, 180),
});

// ------------------------------------------------------------------ citas

export const appointmentFiltersSchema = z.object({
  from: dateISO.optional().catch(undefined),
  to: dateISO.optional().catch(undefined),
  barberId: z.string().max(64).optional().catch(undefined),
  status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
