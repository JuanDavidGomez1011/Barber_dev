import { randomUUID } from "node:crypto";
import type { NotificationProvider, OutgoingMessage, SendResult } from "./provider";

/**
 * Proveedor de desarrollo: no envía nada, escribe el mensaje en los logs del
 * servidor. Es el que se usa mientras no se configure Twilio o WhatsApp Cloud.
 *
 * NOTIFICATIONS_SIMULATE_FAILURE_RATE (0 a 1) hace fallar una parte de los
 * envíos al azar, para probar los reintentos.
 */
export class ConsoleProvider implements NotificationProvider {
  readonly name = "console";

  async send(message: OutgoingMessage): Promise<SendResult> {
    const failureRate = Number(process.env.NOTIFICATIONS_SIMULATE_FAILURE_RATE ?? 0);
    if (failureRate > 0 && Math.random() < failureRate) {
      console.warn(`[whatsapp:simulado] ✗ fallo simulado → ${message.to} (${message.type})`);
      return { ok: false, error: "Fallo simulado (NOTIFICATIONS_SIMULATE_FAILURE_RATE)", retryable: true };
    }

    const id = `sim_${randomUUID().slice(0, 8)}`;
    const indented = message.body.split("\n").map((l) => `   │ ${l}`).join("\n");
    console.info(`[whatsapp:simulado] ✓ ${message.type} → ${message.to} (${id})\n${indented}`);
    return { ok: true, providerMessageId: id };
  }
}
