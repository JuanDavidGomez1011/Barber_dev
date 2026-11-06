import { describe, expect, it } from "vitest";
import {
  clientIpFrom,
  emailKey,
  isLoginBlocked,
  LOGIN_LIMIT,
  minutesUntilRetry,
  windowStart,
} from "@/lib/auth/login-limit";

const headers = (h: Record<string, string>) => ({ get: (name: string) => h[name] ?? null });

describe("isLoginBlocked", () => {
  it("permite por debajo de los límites", () => {
    expect(isLoginBlocked({ email: LOGIN_LIMIT.maxPerEmail - 1, ip: LOGIN_LIMIT.maxPerIp - 1 })).toBe(false);
  });
  it("bloquea al llegar al límite por correo", () => {
    expect(isLoginBlocked({ email: LOGIN_LIMIT.maxPerEmail, ip: 0 })).toBe(true);
  });
  it("bloquea al llegar al límite por IP", () => {
    expect(isLoginBlocked({ email: 0, ip: LOGIN_LIMIT.maxPerIp })).toBe(true);
  });
});

describe("minutesUntilRetry", () => {
  const now = new Date("2026-11-06T15:00:00Z");
  it("cuenta desde el fallo más viejo de la ventana", () => {
    const oldest = new Date(now.getTime() - 10 * 60_000); // hace 10 min, ventana de 15
    expect(minutesUntilRetry(oldest, now)).toBe(5);
  });
  it("redondea hacia arriba y nunca baja de 1", () => {
    expect(minutesUntilRetry(new Date(now.getTime() - 14.5 * 60_000), now)).toBe(1);
    expect(minutesUntilRetry(new Date(now.getTime() - 20 * 60_000), now)).toBe(1);
  });
  it("sin fecha devuelve la ventana completa", () => {
    expect(minutesUntilRetry(null, now)).toBe(LOGIN_LIMIT.windowMinutes);
  });
});

describe("windowStart", () => {
  it("resta la ventana", () => {
    const now = new Date("2026-11-06T15:00:00Z");
    expect(windowStart(now, 15).toISOString()).toBe("2026-11-06T14:45:00.000Z");
  });
});

describe("emailKey", () => {
  it("normaliza el correo", () => {
    expect(emailKey("  Admin@Barberia.Local ")).toBe("email:admin@barberia.local");
  });
});

describe("clientIpFrom", () => {
  it("toma el primer valor de x-forwarded-for", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "190.1.2.3, 10.0.0.1" }))).toBe("190.1.2.3");
  });
  it("usa x-real-ip si no hay x-forwarded-for", () => {
    expect(clientIpFrom(headers({ "x-real-ip": "::1" }))).toBe("::1");
  });
  it("null si no hay encabezados o el valor es absurdo", () => {
    expect(clientIpFrom(headers({}))).toBeNull();
    expect(clientIpFrom(headers({ "x-forwarded-for": "x".repeat(100) }))).toBeNull();
  });
});
