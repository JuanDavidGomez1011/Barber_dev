/**
 * Normaliza un número de WhatsApp a formato E.164.
 * - Celulares colombianos: "300 123 4567", "+57 300-123-4567", "573001234567" → "+573001234567"
 * - Números internacionales con prefijo "+" (8 a 15 dígitos) se aceptan tal cual.
 * Devuelve null si el número no es válido.
 */
export function normalizePhone(raw: string): string | null {
  const hasPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");

  if (!hasPlus && /^3\d{9}$/.test(digits)) return `+57${digits}`;
  if (/^573\d{9}$/.test(digits)) return `+${digits}`;
  if (hasPlus && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}
