import type { NotificationType } from "@/lib/notifications/rules";
import { httpFailure, type NotificationProvider, type OutgoingMessage, type SendResult } from "./provider";

/**
 * Twilio (WhatsApp). Variables de entorno:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM        número remitente, ej. +14155238886 (sandbox)
 *   TWILIO_CONTENT_SID_<TIPO>   opcional, plantilla aprobada por tipo
 *                               (CONFIRMATION, REMINDER_24H, REMINDER_2H, CANCELLATION, RESCHEDULE)
 *
 * Sin plantilla se manda el texto libre (sirve en el sandbox o dentro de la
 * ventana de 24 h); en producción WhatsApp exige plantillas aprobadas.
 */
export class TwilioProvider implements NotificationProvider {
  readonly name = "twilio";

  constructor(
    private readonly config = {
      accountSid: required("TWILIO_ACCOUNT_SID"),
      authToken: required("TWILIO_AUTH_TOKEN"),
      from: required("TWILIO_WHATSAPP_FROM"),
    },
  ) {}

  async send(message: OutgoingMessage): Promise<SendResult> {
    const form = new URLSearchParams({
      From: `whatsapp:${this.config.from}`,
      To: `whatsapp:${message.to}`,
    });
    const contentSid = process.env[`TWILIO_CONTENT_SID_${message.type satisfies NotificationType}`];
    if (contentSid) {
      form.set("ContentSid", contentSid);
      form.set("ContentVariables", JSON.stringify(Object.fromEntries(message.variables.map((v, i) => [String(i + 1), v]))));
    } else {
      form.set("Body", message.body);
    }

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) return httpFailure(res.status, data.message ?? res.statusText);
      return { ok: true, providerMessageId: data.sid };
    } catch (error) {
      return { ok: false, error: `Red: ${(error as Error).message}`, retryable: true };
    }
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (NOTIFICATIONS_PROVIDER=twilio).`);
  return value;
}
