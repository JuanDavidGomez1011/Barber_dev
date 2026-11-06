"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { createBookingSchema, rescheduleSchema, type CreateBookingInput, type RescheduleInput } from "@/lib/validation/booking";
import { processDue, safeSchedule, type AppointmentEvent } from "../notifications/service";
import { BookingError, cancelBooking, createBooking, rescheduleBooking } from "../services/booking.service";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined>; code?: string };

function handleError(error: unknown): ActionResult {
  if (error instanceof BookingError) return { ok: false, error: error.message, code: error.code };
  console.error("[booking] error inesperado", error);
  return { ok: false, error: "Algo salió mal. Intenta de nuevo en un momento." };
}

/**
 * Deja en cola los mensajes de WhatsApp del evento y manda los inmediatos
 * (confirmación, cambio, cancelación) apenas se responde al usuario, sin hacerlo esperar.
 * Los recordatorios salen después con el cron.
 */
async function notify(appointmentId: string, event: AppointmentEvent) {
  await safeSchedule(appointmentId, event);
  after(() => processDue({ appointmentId }).catch((e) => console.error("[notificaciones] envío inmediato", e)));
}

/** Crea la reserva y redirige a la página de la cita. */
export async function createBookingAction(input: CreateBookingInput): Promise<ActionResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisa los datos del formulario.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { serviceId, barberId, startsAt, name, phone, note } = parsed.data;

  let token: string;
  try {
    const result = await createBooking({ serviceId, barberId, startsAt: new Date(startsAt), name, phone, note });
    token = result.token;
    await notify(result.appointment.id, "created");
  } catch (error) {
    return handleError(error);
  }
  redirect(`/cita/${token}?nueva=1`);
}

export async function cancelBookingAction(token: string): Promise<ActionResult> {
  if (typeof token !== "string" || token.length < 10 || token.length > 200) {
    return { ok: false, error: "Enlace no válido." };
  }
  try {
    const id = await cancelBooking(token);
    await notify(id, "cancelled");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function rescheduleBookingAction(input: RescheduleInput): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Horario no válido." };
  try {
    const id = await rescheduleBooking(parsed.data.token, {
      barberId: parsed.data.barberId,
      startsAt: new Date(parsed.data.startsAt),
    });
    await notify(id, "rescheduled");
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}
