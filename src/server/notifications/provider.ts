import type { NotificationType } from "@/lib/notifications/rules";

/** Mensaje listo para enviar. */
export interface OutgoingMessage {
  /** Número en formato E.164: +573001234567 */
  to: string;
  type: NotificationType;
  /** Texto completo (canales que aceptan texto libre). */
  body: string;
  /** Valores para plantillas aprobadas ({{1}}, {{2}}…), en orden. */
  variables: string[];
}

export type SendResult =
  | { ok: true; providerMessageId?: string }
  /** `retryable`: un error temporal (red, 5xx, límite de tasa) que vale la pena reintentar. */
  | { ok: false; error: string; retryable: boolean };

/**
 * Contrato de cualquier canal de envío. Para conectar un proveedor nuevo basta
 * con implementar `send` y registrarlo en `index.ts`.
 */
export interface NotificationProvider {
  readonly name: string;
  send(message: OutgoingMessage): Promise<SendResult>;
}

/** Clasifica una respuesta HTTP fallida de un proveedor. */
export function httpFailure(status: number, detail: string): SendResult {
  return { ok: false, error: `HTTP ${status}: ${detail.slice(0, 300)}`, retryable: status === 429 || status >= 500 };
}
