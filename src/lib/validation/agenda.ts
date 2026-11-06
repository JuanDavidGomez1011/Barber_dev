import { z } from "zod";
import { parseTimeHHmm } from "../time";

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const timeHHmm = z
  .string()
  .refine((v) => parseTimeHHmm(v) !== null, "Hora no válida")
  .transform((v) => parseTimeHHmm(v)!);

export const statusChangeSchema = z.object({
  appointmentId: z.string().min(1).max(64),
  status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW"]),
});

export const blockSchema = z
  .object({
    date: dateISO,
    allDay: z.boolean().default(false),
    start: z.string().optional(),
    end: z.string().optional(),
    reason: z
      .string()
      .trim()
      .max(100, "Máximo 100 caracteres")
      .optional()
      .transform((v) => v || null),
    repeatUntil: z
      .string()
      .optional()
      .transform((v) => v || null)
      .pipe(dateISO.nullable()),
  })
  .transform((v, ctx) => {
    if (v.allDay) return { ...v, startMinute: 0, endMinute: 24 * 60 };
    const start = timeHHmm.safeParse(v.start ?? "");
    const end = timeHHmm.safeParse(v.end ?? "");
    if (!start.success || !end.success) {
      ctx.addIssue({ code: "custom", message: "Indica la hora de inicio y de fin", path: ["start"] });
      return z.NEVER;
    }
    if (end.data <= start.data) {
      ctx.addIssue({ code: "custom", message: "La hora final debe ser posterior a la inicial", path: ["end"] });
      return z.NEVER;
    }
    return { ...v, startMinute: start.data, endMinute: end.data };
  });
export type BlockInput = z.input<typeof blockSchema>;
