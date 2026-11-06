"use server";

import { refresh } from "next/cache";
import { blockSchema, statusChangeSchema, type BlockInput } from "@/lib/validation/agenda";
import { formatLongDate, formatTime } from "@/lib/format";
import { requireBarber } from "../auth/dal";
import { AgendaError, createTimeBlocks, deleteTimeBlock, setAppointmentStatus } from "../services/agenda.service";

export type AgendaActionResult = { ok: true; message?: string } | { ok: false; error: string; conflicts?: string[] };

function fail(error: unknown): AgendaActionResult {
  if (error instanceof AgendaError) return { ok: false, error: error.message };
  console.error("[agenda] error inesperado", error);
  return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
}

export async function setAppointmentStatusAction(appointmentId: string, status: string): Promise<AgendaActionResult> {
  const { barber } = await requireBarber();
  const parsed = statusChangeSchema.safeParse({ appointmentId, status });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  try {
    await setAppointmentStatus({ role: "BARBER", barberId: barber.id }, parsed.data.appointmentId, parsed.data.status);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function createBlockAction(input: BlockInput): Promise<AgendaActionResult> {
  const { barber } = await requireBarber();
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { date, startMinute, endMinute, reason, repeatUntil } = parsed.data;

  try {
    const result = await createTimeBlocks(barber.id, { date, startMinute, endMinute, reason, repeatUntil });
    if (result.conflicts.length > 0) {
      return {
        ok: false,
        error: "No se creó el bloqueo porque se cruza con citas confirmadas. Coordina con el cliente o pide al administrador que las mueva o cancele:",
        conflicts: result.conflicts.map(
          (c) => `${formatLongDate(c.startsAt)}, ${formatTime(c.startsAt)} · ${c.customer} (${c.service})`,
        ),
      };
    }
    refresh();
    return { ok: true, message: result.created === 1 ? "Bloqueo creado." : `${result.created} bloqueos creados.` };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBlockAction(blockId: string): Promise<AgendaActionResult> {
  const { barber } = await requireBarber();
  if (typeof blockId !== "string" || blockId.length > 64) return { ok: false, error: "Datos inválidos." };
  try {
    await deleteTimeBlock(barber.id, blockId);
    refresh();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
