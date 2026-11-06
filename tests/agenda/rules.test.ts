import { describe, expect, it } from "vitest";
import { checkStatusTransition, expandBlockDates, MAX_BLOCK_REPEAT_DAYS } from "@/lib/agenda/rules";
import { addDaysISO, startOfWeekISO } from "@/lib/time";

const start = new Date("2026-11-10T15:00:00Z");
const before = new Date("2026-11-10T14:59:00Z");
const after = new Date("2026-11-10T15:30:00Z");

describe("checkStatusTransition", () => {
  it("permite completar o marcar inasistencia cuando la cita ya empezó", () => {
    expect(checkStatusTransition("CONFIRMED", "COMPLETED", start, after).ok).toBe(true);
    expect(checkStatusTransition("CONFIRMED", "NO_SHOW", start, start).ok).toBe(true);
  });

  it("no permite marcarla antes de que empiece", () => {
    expect(checkStatusTransition("CONFIRMED", "COMPLETED", start, before).ok).toBe(false);
    expect(checkStatusTransition("CONFIRMED", "NO_SHOW", start, before).ok).toBe(false);
  });

  it("permite deshacer y corregir", () => {
    expect(checkStatusTransition("COMPLETED", "CONFIRMED", start, after).ok).toBe(true);
    expect(checkStatusTransition("NO_SHOW", "COMPLETED", start, after).ok).toBe(true);
  });

  it("no toca citas canceladas ni permite cancelar desde la agenda", () => {
    expect(checkStatusTransition("CANCELLED", "COMPLETED", start, after).ok).toBe(false);
    expect(checkStatusTransition("CONFIRMED", "CANCELLED", start, after).ok).toBe(false);
  });

  it("rechaza el mismo estado", () => {
    expect(checkStatusTransition("COMPLETED", "COMPLETED", start, after).ok).toBe(false);
  });
});

describe("expandBlockDates", () => {
  const monToSat = new Set([1, 2, 3, 4, 5, 6]);

  it("sin repetición devuelve solo el día", () => {
    expect(expandBlockDates("2026-11-10", null, monToSat)).toEqual(["2026-11-10"]);
  });

  it("repite solo en días laborales del barbero", () => {
    // mar 10 → lun 16: se salta el domingo 15
    expect(expandBlockDates("2026-11-10", "2026-11-16", monToSat)).toEqual([
      "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-16",
    ]);
  });

  it("incluye el primer día aunque no sea laboral", () => {
    expect(expandBlockDates("2026-11-15", "2026-11-16", monToSat)).toEqual(["2026-11-15", "2026-11-16"]);
  });

  it(`no repite más de ${MAX_BLOCK_REPEAT_DAYS} días`, () => {
    const all = new Set([0, 1, 2, 3, 4, 5, 6]);
    const dates = expandBlockDates("2026-11-10", "2027-12-31", all);
    expect(dates.at(-1)).toBe(addDaysISO("2026-11-10", MAX_BLOCK_REPEAT_DAYS));
  });
});

describe("startOfWeekISO", () => {
  it("devuelve el lunes de la semana", () => {
    expect(startOfWeekISO("2026-11-12")).toBe("2026-11-09"); // jueves → lunes
    expect(startOfWeekISO("2026-11-09")).toBe("2026-11-09"); // lunes
    expect(startOfWeekISO("2026-11-15")).toBe("2026-11-09"); // domingo → lunes anterior
  });
});
