import { describe, expect, it } from "vitest";
import { addDaysISO, dayOfWeekISO, formatMinute, toDateISO, toMinuteOfDay, zonedToUtc } from "@/lib/time";

describe("utilidades de zona horaria (America/Bogota, UTC-5)", () => {
  it("convierte hora local de Bogotá a UTC", () => {
    expect(zonedToUtc("2026-11-05", 9 * 60).toISOString()).toBe("2026-11-05T14:00:00.000Z");
  });

  it("una hora local tarde en la noche cae en el día siguiente en UTC", () => {
    expect(zonedToUtc("2026-11-05", 20 * 60).toISOString()).toBe("2026-11-06T01:00:00.000Z");
  });

  it("obtiene fecha y minuto locales a partir de un instante UTC", () => {
    const instant = new Date("2026-11-06T01:30:00.000Z");
    expect(toDateISO(instant)).toBe("2026-11-05");
    expect(toMinuteOfDay(instant)).toBe(20 * 60 + 30);
  });

  it("suma días cruzando meses y años", () => {
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula el día de la semana (0 = domingo)", () => {
    expect(dayOfWeekISO("2026-11-05")).toBe(4); // jueves
    expect(dayOfWeekISO("2026-11-08")).toBe(0); // domingo
  });

  it("formatea minutos como HH:mm", () => {
    expect(formatMinute(9 * 60 + 5)).toBe("09:05");
  });
});
