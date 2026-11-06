import "server-only";
import { ConsoleProvider } from "./console.provider";
import type { NotificationProvider } from "./provider";
import { TwilioProvider } from "./twilio.provider";
import { WhatsAppCloudProvider } from "./whatsapp-cloud.provider";

/**
 * Proveedor activo según NOTIFICATIONS_PROVIDER: "console" (por defecto),
 * "twilio" o "whatsapp-cloud". Cambiar de proveedor es solo cambiar la variable.
 */
let cached: NotificationProvider | undefined;

export function getProvider(): NotificationProvider {
  if (cached) return cached;
  const name = (process.env.NOTIFICATIONS_PROVIDER ?? "console").toLowerCase();
  switch (name) {
    case "console":
      cached = new ConsoleProvider();
      break;
    case "twilio":
      cached = new TwilioProvider();
      break;
    case "whatsapp-cloud":
      cached = new WhatsAppCloudProvider();
      break;
    default:
      throw new Error(`NOTIFICATIONS_PROVIDER desconocido: "${name}" (usa console, twilio o whatsapp-cloud).`);
  }
  return cached;
}

export type { NotificationProvider, OutgoingMessage, SendResult } from "./provider";
