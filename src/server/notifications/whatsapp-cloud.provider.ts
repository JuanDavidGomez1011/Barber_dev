import { httpFailure, type NotificationProvider, type OutgoingMessage, type SendResult } from "./provider";

/**
 * WhatsApp Business Cloud API (Meta). Variables de entorno:
 *   WHATSAPP_PHONE_NUMBER_ID   ID del número en Meta for Developers
 *   WHATSAPP_ACCESS_TOKEN      token de acceso (de sistema, permanente)
 *   WHATSAPP_API_VERSION       opcional, ej. v23.0 (revisa la versión vigente en la documentación de Meta)
 *   WHATSAPP_TEMPLATE_<TIPO>   opcional, nombre de la plantilla aprobada por tipo
 *                              (por defecto: barberia_confirmacion, barberia_recordatorio_24h, …)
 *   WHATSAPP_TEMPLATE_LANG     opcional, por defecto "es"
 *
 * Los mensajes que inicia el negocio deben usar plantillas aprobadas por Meta.
 * Cada plantilla debe tener en su cuerpo tantas variables {{1}}, {{2}}… como
 * valores entrega `renderMessage(...).variables` para ese tipo.
 */
const DEFAULT_TEMPLATES = {
  CONFIRMATION: "barberia_confirmacion",
  REMINDER_24H: "barberia_recordatorio_24h",
  REMINDER_2H: "barberia_recordatorio_2h",
  CANCELLATION: "barberia_cancelacion",
  RESCHEDULE: "barberia_reprogramacion",
} as const;

export class WhatsAppCloudProvider implements NotificationProvider {
  readonly name = "whatsapp-cloud";

  constructor(
    private readonly config = {
      phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
      accessToken: required("WHATSAPP_ACCESS_TOKEN"),
      apiVersion: process.env.WHATSAPP_API_VERSION ?? "v23.0",
      language: process.env.WHATSAPP_TEMPLATE_LANG ?? "es",
    },
  ) {}

  async send(message: OutgoingMessage): Promise<SendResult> {
    const template = process.env[`WHATSAPP_TEMPLATE_${message.type}`] ?? DEFAULT_TEMPLATES[message.type];
    const payload = {
      messaging_product: "whatsapp",
      to: message.to.replace(/\D/g, ""),
      type: "template",
      template: {
        name: template,
        language: { code: this.config.language },
        components: [
          {
            type: "body",
            // WhatsApp no acepta parámetros vacíos.
            parameters: message.variables.map((text) => ({ type: "text", text: text || "-" })),
          },
        ],
      },
    };

    try {
      const res = await fetch(`https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      if (!res.ok) return httpFailure(res.status, data.error?.message ?? res.statusText);
      return { ok: true, providerMessageId: data.messages?.[0]?.id };
    } catch (error) {
      return { ok: false, error: `Red: ${(error as Error).message}`, retryable: true };
    }
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (NOTIFICATIONS_PROVIDER=whatsapp-cloud).`);
  return value;
}
