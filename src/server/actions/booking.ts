"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createBookingSchema, rescheduleSchema, type CreateBookingInput, type RescheduleInput } from "@/lib/validation/booking";
import { BookingError, cancelBooking, createBooking, rescheduleBooking } from "../services/booking.service";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined>; code?: string };

function handleError(error: unknown): ActionResult {
  if (error instanceof BookingError) return { ok: false, error: error.message, code: error.code };
  console.error("[booking] error inesperado", error);
  return { ok: false, error: "Algo salió mal. Intenta de nuevo en un momento." };
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
    ({ token } = await createBooking({ serviceId, barberId, startsAt: new Date(startsAt), name, phone, note }));
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
    await cancelBooking(token);
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}

export async function rescheduleBookingAction(input: RescheduleInput): Promise<ActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Horario no válido." };
  try {
    await rescheduleBooking(parsed.data.token, {
      barberId: parsed.data.barberId,
      startsAt: new Date(parsed.data.startsAt),
    });
    return { ok: true };
  } catch (error) {
    return handleError(error);
  }
}
