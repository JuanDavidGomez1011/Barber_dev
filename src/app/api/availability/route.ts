import type { NextRequest } from "next/server";
import { z } from "zod";
import { availabilityQuerySchema } from "@/lib/validation/booking";
import { hashToken } from "@/lib/tokens";
import { db } from "@/server/db";
import { AvailabilityError, getAvailability } from "@/server/services/availability.service";

/**
 * GET /api/availability?serviceId=…&barberId=any|<id>&from=YYYY-MM-DD&days=N[&token=…]
 * Devuelve los horarios realmente disponibles por día. Siempre se calcula en el
 * momento (no se cachea): depende de la hora actual y de las citas.
 */
export async function GET(request: NextRequest) {
  const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "Parámetros inválidos", details: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  }
  const { serviceId, barberId, from, days, token } = parsed.data;

  let excludeAppointmentId: string | undefined;
  if (token) {
    const appt = await db.appointment.findUnique({ where: { manageTokenHash: hashToken(token) }, select: { id: true } });
    excludeAppointmentId = appt?.id;
  }

  try {
    const result = await getAvailability(db, { serviceId, barberId, from, days, excludeAppointmentId });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AvailabilityError) return Response.json({ error: error.message }, { status: 404 });
    console.error("[availability]", error);
    return Response.json({ error: "No pudimos cargar los horarios." }, { status: 500 });
  }
}
