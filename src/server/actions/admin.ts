"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { z } from "zod";
import {
  barberSchema,
  businessHoursSchema,
  closedDaySchema,
  newBarberSchema,
  passwordSchema,
  serviceSchema,
  settingsSchema,
  workingHoursSchema,
} from "@/lib/validation/admin";
import { statusChangeSchema } from "@/lib/validation/agenda";
import { requireAdmin } from "../auth/dal";
import { CATALOG_TAG } from "../catalog";
import { processDue, retryNotification, safeSchedule } from "../notifications/service";
import * as admin from "../services/admin.service";
import { AgendaError, setAppointmentStatus } from "../services/agenda.service";

/** Estado de los formularios con `useActionState`. */
export type FormState = { ok: boolean; message?: string; error?: string } | undefined;

const fields = (fd: FormData) => Object.fromEntries(fd);
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Revisa los datos.";

/** Ejecuta la acción con manejo de errores común y refresca la vista. */
async function run(fn: () => Promise<string | void>, opts: { catalog?: boolean } = {}): Promise<FormState> {
  await requireAdmin();
  try {
    const message = await fn();
    // El catálogo público (servicios, barberos, datos del negocio) está en caché: se invalida al editarlo.
    if (opts.catalog) updateTag(CATALOG_TAG);
    refresh();
    return { ok: true, message: message || "Cambios guardados." };
  } catch (error) {
    if (error instanceof admin.AdminError || error instanceof AgendaError) return { ok: false, error: error.message };
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error("[admin] error inesperado", error);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

class ValidationError extends Error {}
function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(firstIssue(result.error));
  return result.data;
}

// ------------------------------------------------------------------ servicios

export async function saveServiceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const data = parse(serviceSchema, fields(fd));
    const id = fd.get("id");
    if (typeof id === "string" && id) await admin.updateService(id, data);
    else await admin.createService(data);
    return typeof id === "string" && id ? "Servicio actualizado." : "Servicio creado.";
  }, { catalog: true });
}

export async function deleteServiceAction(id: string): Promise<FormState> {
  return run(async () => {
    await admin.deleteService(id);
    return "Servicio eliminado.";
  }, { catalog: true });
}

// ------------------------------------------------------------------ barberos

export async function createBarberAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = newBarberSchema.safeParse({ ...fields(fd), serviceIds: fd.getAll("serviceIds") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  let id: string;
  try {
    id = (await admin.createBarber(parsed.data)).id;
  } catch (error) {
    if (error instanceof admin.AdminError) return { ok: false, error: error.message };
    console.error("[admin] crear barbero", error);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
  updateTag(CATALOG_TAG);
  // Siguiente paso natural: definir sus horarios.
  redirect(`/admin/barberos/${id}?nuevo=1`);
}

export async function updateBarberAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = String(fd.get("id") ?? "");
    const data = parse(barberSchema, { ...fields(fd), serviceIds: fd.getAll("serviceIds") });
    await admin.updateBarber(id, data);
    if (!data.active) {
      const pending = await admin.futureConfirmedCount(id);
      if (pending > 0) return `Guardado. Ojo: tiene ${pending} citas confirmadas próximas; cancélalas o reasígnalas desde Citas.`;
    }
    return "Barbero actualizado.";
  }, { catalog: true });
}

export async function setBarberPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const { password } = parse(passwordSchema, fields(fd));
    await admin.setBarberPassword(String(fd.get("id") ?? ""), password);
    return "Contraseña actualizada.";
  });
}

export async function setWorkingHoursAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("shifts") ?? "[]"));
    } catch {
      throw new ValidationError("Datos de horario inválidos.");
    }
    const shifts = parse(workingHoursSchema, raw);
    await admin.setWorkingHours(String(fd.get("id") ?? ""), shifts);
    return "Horario guardado.";
  });
}

// ------------------------------------------------------------------ local

export async function setBusinessHoursAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      isClosed: fd.get(`closed_${d}`) === "on",
      open: String(fd.get(`open_${d}`) ?? "09:00"),
      close: String(fd.get(`close_${d}`) ?? "20:00"),
    }));
    await admin.setBusinessHours(parse(businessHoursSchema, days));
    return "Horario de atención guardado.";
  });
}

export async function createClosedDayAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const data = parse(closedDaySchema, fields(fd));
    const result = await admin.createClosedDay(data);
    if (!result.created) {
      throw new ValidationError(
        `Ese día hay ${result.conflicts} citas confirmadas. Marca "Crear de todas formas" y luego cancélalas desde Citas.`,
      );
    }
    return result.conflicts > 0
      ? `Día cerrado. Recuerda cancelar las ${result.conflicts} citas confirmadas de ese día.`
      : "Día cerrado agregado.";
  });
}

export async function deleteClosedDayAction(id: string): Promise<FormState> {
  return run(async () => {
    await admin.deleteClosedDay(id);
    return "Día cerrado eliminado.";
  });
}

export async function saveSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const data = parse(settingsSchema, fields(fd));
    await admin.updateSettings(data);
    return "Ajustes guardados.";
  }, { catalog: true });
}

// ------------------------------------------------------------------ citas

export async function adminSetStatusAction(appointmentId: string, status: string): Promise<FormState> {
  return run(async () => {
    const data = parse(statusChangeSchema, { appointmentId, status });
    await setAppointmentStatus({ role: "ADMIN", barberId: null }, data.appointmentId, data.status);
  });
}

export async function adminCancelAction(appointmentId: string, reason: string): Promise<FormState> {
  return run(async () => {
    await admin.adminCancelAppointment(appointmentId, reason.trim().slice(0, 120) || null);
    // Avisa al cliente por WhatsApp (en segundo plano, sin hacer esperar al admin).
    await safeSchedule(appointmentId, "cancelled");
    after(() => processDue({ appointmentId }).catch((e) => console.error("[notificaciones]", e)));
    return "Cita cancelada. Se le avisará al cliente por WhatsApp.";
  });
}

// ------------------------------------------------------------------ notificaciones

/** Envía ya las notificaciones vencidas (lo mismo que hace el cron). */
export async function processNotificationsNowAction(): Promise<FormState> {
  return run(async () => {
    const r = await processDue({ limit: 50 });
    if (r.claimed === 0) return "No había notificaciones pendientes por enviar.";
    return `Procesadas ${r.claimed}: ${r.sent} enviadas, ${r.retried} para reintentar, ${r.failed} fallidas, ${r.skipped} descartadas.`;
  });
}

export async function retryNotificationAction(id: string): Promise<FormState> {
  return run(async () => {
    if (!(await retryNotification(id))) throw new ValidationError("Solo se pueden reintentar las fallidas o descartadas.");
    await processDue({ limit: 5 });
    return "Reintentada.";
  });
}
