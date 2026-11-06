import { z } from "zod";
import { normalizePhone } from "../phone";

const id = z.string().min(1).max(64);

/** "any" o vacío = cualquier barbero disponible. */
export const barberChoiceSchema = z
  .string()
  .max(64)
  .optional()
  .transform((v) => (!v || v === "any" ? null : v));

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre")
    .max(80, "El nombre es muy largo"),
  phone: z
    .string()
    .trim()
    .min(1, "Escribe tu número de WhatsApp")
    .transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Número no válido. Ej: 300 123 4567" });
        return z.NEVER;
      }
      return phone;
    }),
  note: z
    .string()
    .trim()
    .max(300, "La nota puede tener máximo 300 caracteres")
    .optional()
    .transform((v) => v || null),
});

export const createBookingSchema = customerSchema.extend({
  serviceId: id,
  barberId: barberChoiceSchema,
  startsAt: z.iso.datetime({ offset: true, error: "Horario no válido" }),
  /** Campo trampa contra bots: debe llegar vacío. */
  website: z.string().max(0).optional(),
});
export type CreateBookingInput = z.input<typeof createBookingSchema>;

export const rescheduleSchema = z.object({
  token: z.string().min(10).max(200),
  barberId: barberChoiceSchema,
  startsAt: z.iso.datetime({ offset: true, error: "Horario no válido" }),
});
export type RescheduleInput = z.input<typeof rescheduleSchema>;

export const availabilityQuerySchema = z.object({
  serviceId: id,
  barberId: barberChoiceSchema,
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(60).optional(),
  /** Al reprogramar: el horario de esta cita no cuenta como ocupado. */
  token: z.string().max(200).optional(),
});
