import { beforeAll, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { isStale, planReminders, retryDelayMinutes } from "@/lib/notifications/rules";
import { renderMessage, type MessageContext } from "@/lib/notifications/templates";

const H = 3600_000;
const now = new Date("2026-11-10T12:00:00Z");

describe("planReminders", () => {
  it("programa 24 h y 2 h antes si la cita es en varios días", () => {
    const startsAt = new Date(now.getTime() + 72 * H);
    const plan = planReminders(startsAt, now);
    expect(plan.map((p) => p.type)).toEqual(["REMINDER_24H", "REMINDER_2H"]);
    expect(plan[0].scheduledFor.getTime()).toBe(startsAt.getTime() - 24 * H);
    expect(plan[1].scheduledFor.getTime()).toBe(startsAt.getTime() - 2 * H);
  });

  it("si la cita es en 5 h, solo el de 2 h", () => {
    expect(planReminders(new Date(now.getTime() + 5 * H), now).map((p) => p.type)).toEqual(["REMINDER_2H"]);
  });

  it("si se reservó con 2 h justas, no manda recordatorio (llegaría junto con la confirmación)", () => {
    expect(planReminders(new Date(now.getTime() + 2 * H + 5 * 60_000), now)).toEqual([]);
  });
});

describe("retryDelayMinutes", () => {
  it("espera 5 y luego 10 minutos", () => {
    expect(retryDelayMinutes(1)).toBe(5);
    expect(retryDelayMinutes(2)).toBe(10);
  });
});

describe("isStale", () => {
  const appt = { status: "CONFIRMED", startsAt: new Date(now.getTime() + 3 * H) };

  it("un recordatorio vigente se envía", () => {
    expect(isStale({ type: "REMINDER_2H", scheduledFor: now }, appt, now)).toBeNull();
  });

  it("no recuerda citas canceladas", () => {
    expect(isStale({ type: "REMINDER_2H", scheduledFor: now }, { ...appt, status: "CANCELLED" }, now)).not.toBeNull();
  });

  it("no recuerda una cita que está por empezar", () => {
    const soon = { ...appt, startsAt: new Date(now.getTime() + 10 * 60_000) };
    expect(isStale({ type: "REMINDER_24H", scheduledFor: now }, soon, now)).not.toBeNull();
  });

  it("la confirmación de una cita ya cancelada no se envía", () => {
    expect(isStale({ type: "CONFIRMATION", scheduledFor: now }, { ...appt, status: "CANCELLED" }, now)).not.toBeNull();
  });

  it("el aviso de cancelación sí se envía aunque la cita esté cancelada", () => {
    expect(isStale({ type: "CANCELLATION", scheduledFor: now }, { ...appt, status: "CANCELLED" }, now)).toBeNull();
  });

  it("un mensaje atrasado más de 24 h se descarta", () => {
    const old = new Date(now.getTime() - 25 * H);
    expect(isStale({ type: "CANCELLATION", scheduledFor: old }, { ...appt, status: "CANCELLED" }, now)).not.toBeNull();
  });
});

describe("renderMessage", () => {
  const ctx: MessageContext = {
    businessName: "Barbería Demo",
    customerName: "Juan Pérez",
    serviceName: "Corte clásico",
    barberName: "Carlos",
    startsAt: new Date("2026-11-10T15:30:00Z"), // 10:30 a. m. en Bogotá
    timezone: "America/Bogota",
    address: "Calle 10 # 5-20",
    manageUrl: "https://ejemplo.com/cita/abc",
  };

  it("la confirmación incluye servicio, barbero, fecha en hora de Bogotá y enlace", () => {
    const { body } = renderMessage("CONFIRMATION", ctx);
    expect(body).toContain("Hola Juan");
    expect(body).toContain("Corte clásico con Carlos");
    expect(body).toContain("Martes, 10 de noviembre a las 10:30");
    expect(body).toContain("https://ejemplo.com/cita/abc");
  });

  it("sin enlace no deja texto colgando", () => {
    const { body } = renderMessage("REMINDER_24H", { ...ctx, manageUrl: null });
    expect(body).not.toContain("Cancelar o reprogramar");
  });

  it("la cancelación incluye el motivo si existe", () => {
    expect(renderMessage("CANCELLATION", { ...ctx, cancelReason: "Barbero enfermo" }).body).toContain("Motivo: Barbero enfermo");
  });

  it("entrega variables en orden para plantillas de WhatsApp", () => {
    expect(renderMessage("CONFIRMATION", ctx).variables.slice(0, 2)).toEqual(["Juan", "Corte clásico"]);
  });
});

describe("encryptToken / decryptToken", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = "x".repeat(40);
  });

  it("descifra lo que cifró", () => {
    expect(decryptToken(encryptToken("mi-token-secreto"))).toBe("mi-token-secreto");
  });

  it("cada cifrado es distinto (IV aleatorio)", () => {
    expect(encryptToken("t")).not.toBe(encryptToken("t"));
  });

  it("si se altera, devuelve null", () => {
    const enc = encryptToken("mi-token");
    const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
    expect(decryptToken(tampered)).toBeNull();
  });
});
