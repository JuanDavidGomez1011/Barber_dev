/**
 * Textos de los mensajes de WhatsApp. Un solo lugar para editarlos.
 *
 * La API oficial de WhatsApp Business exige plantillas aprobadas por Meta para
 * mensajes que inicia el negocio: `variables` da los valores en orden para
 * {{1}}, {{2}}… y `body` es el texto completo (Twilio sandbox, consola, vista previa).
 */
import { formatLongDate, formatTime } from "../format";
import type { NotificationType } from "./rules";

export interface MessageContext {
  businessName: string;
  customerName: string;
  serviceName: string;
  barberName: string;
  startsAt: Date;
  timezone: string;
  address: string | null;
  /** Enlace para cancelar o reprogramar; null si no se pudo reconstruir. */
  manageUrl: string | null;
  cancelReason?: string | null;
}

export interface RenderedMessage {
  body: string;
  variables: string[];
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export function renderMessage(type: NotificationType, ctx: MessageContext): RenderedMessage {
  const name = firstName(ctx.customerName);
  const when = `${formatLongDate(ctx.startsAt, ctx.timezone).toLowerCase()} a las ${formatTime(ctx.startsAt, ctx.timezone)}`;
  const link = ctx.manageUrl ? `\n\nCancelar o reprogramar: ${ctx.manageUrl}` : "";
  const where = ctx.address ? `\n📍 ${ctx.address}` : "";
  const vars = [name, ctx.serviceName, when, ctx.barberName, ctx.manageUrl ?? ""];

  switch (type) {
    case "CONFIRMATION":
      return {
        body: `Hola ${name} 👋 Tu cita en ${ctx.businessName} quedó confirmada.\n\n✂️ ${ctx.serviceName} con ${ctx.barberName}\n🗓️ ${capitalize(when)}${where}${link}`,
        variables: vars,
      };
    case "REMINDER_24H":
      return {
        body: `Hola ${name}, te recordamos tu cita de mañana en ${ctx.businessName}: ${ctx.serviceName} con ${ctx.barberName}, ${when}.${where}${link}`,
        variables: vars,
      };
    case "REMINDER_2H":
      return {
        body: `${name}, tu cita en ${ctx.businessName} es en 2 horas (${formatTime(ctx.startsAt, ctx.timezone)}) con ${ctx.barberName}. ¡Te esperamos!${where}`,
        variables: vars,
      };
    case "RESCHEDULE":
      return {
        body: `Hola ${name}, tu cita en ${ctx.businessName} cambió.\n\n✂️ ${ctx.serviceName} con ${ctx.barberName}\n🗓️ ${capitalize(when)}${link}`,
        variables: vars,
      };
    case "CANCELLATION":
      return {
        body: `Hola ${name}, tu cita en ${ctx.businessName} del ${when} fue cancelada.${ctx.cancelReason ? `\nMotivo: ${ctx.cancelReason}` : ""}\n\nCuando quieras, puedes reservar de nuevo.`,
        variables: [name, ctx.serviceName, when, ctx.cancelReason ?? ""],
      };
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
