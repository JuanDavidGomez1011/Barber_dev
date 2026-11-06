import { describe, expect, it } from "vitest";
import {
  computeBarberSlots,
  mergeBarberSlots,
  pickLeastBusyBarber,
  type BarberDayInput,
} from "@/lib/availability/compute-slots";
import { formatMinute, zonedToUtc } from "@/lib/time";

const TZ = "America/Bogota";
const DATE = "2026-11-10"; // martes
const h = (hh: number, mm = 0) => hh * 60 + mm;
/** Instante UTC de una hora local de DATE. */
const at = (hh: number, mm = 0) => zonedToUtc(DATE, h(hh, mm), TZ).getTime();

function input(overrides: Partial<BarberDayInput> = {}): BarberDayInput {
  return {
    date: DATE,
    timezone: TZ,
    durationMin: 30,
    intervalMin: 15,
    day: { closed: false, openMinute: h(9), closeMinute: h(20) },
    shifts: [{ startMinute: h(9), endMinute: h(11) }],
    busy: [],
    earliestStart: 0,
    ...overrides,
  };
}
const times = (slots: number[]) => slots.map(formatMinute);

describe("computeBarberSlots", () => {
  it("genera horarios cada 15 min donde cabe el servicio completo", () => {
    expect(times(computeBarberSlots(input()))).toEqual([
      "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30",
    ]);
  });

  it("el último horario termina justo al cierre del turno", () => {
    const slots = computeBarberSlots(input({ durationMin: 60 }));
    expect(times(slots).at(-1)).toBe("10:00");
  });

  it("no devuelve nada si el servicio no cabe en el turno", () => {
    expect(computeBarberSlots(input({ durationMin: 150 }))).toEqual([]);
  });

  it("no devuelve nada si el día está cerrado (festivo o día libre)", () => {
    expect(computeBarberSlots(input({ day: { closed: true, openMinute: h(9), closeMinute: h(20) } }))).toEqual([]);
  });

  it("no devuelve nada si el barbero no tiene turnos ese día", () => {
    expect(computeBarberSlots(input({ shifts: [] }))).toEqual([]);
  });

  it("excluye horarios que se cruzan con una cita existente", () => {
    // Cita de 9:30 a 10:00 → un corte de 30 min no puede empezar a las 9:15 ni a las 9:45
    const slots = computeBarberSlots(input({ busy: [{ start: at(9, 30), end: at(10) }] }));
    expect(times(slots)).toEqual(["09:00", "10:00", "10:15", "10:30"]);
  });

  it("permite empezar justo cuando termina otra cita (intervalos semiabiertos)", () => {
    const slots = computeBarberSlots(input({ busy: [{ start: at(9), end: at(9, 30) }] }));
    expect(times(slots)[0]).toBe("09:30");
  });

  it("permite terminar justo cuando empieza otra cita", () => {
    const slots = computeBarberSlots(input({ busy: [{ start: at(10), end: at(11) }] }));
    expect(times(slots)).toEqual(["09:00", "09:15", "09:30"]);
  });

  it("respeta los bloqueos (almuerzo) igual que las citas", () => {
    const slots = computeBarberSlots(
      input({
        shifts: [{ startMinute: h(12), endMinute: h(15) }],
        busy: [{ start: at(13), end: at(14) }],
      }),
    );
    expect(times(slots)).toEqual(["12:00", "12:15", "12:30", "14:00", "14:15", "14:30"]);
  });

  it("un servicio largo no cabe en un hueco corto entre citas", () => {
    const slots = computeBarberSlots(
      input({
        durationMin: 60,
        shifts: [{ startMinute: h(9), endMinute: h(12) }],
        busy: [
          { start: at(9), end: at(9, 30) },
          { start: at(10, 15), end: at(10, 45) }, // hueco de 45 min entre 9:30 y 10:15
        ],
      }),
    );
    expect(times(slots)).toEqual(["10:45", "11:00"]);
  });

  it("aplica la anticipación mínima", () => {
    // "Ahora" son las 8:20 y hay 2 h de anticipación → primer horario 10:20 → redondea a 10:30
    const slots = computeBarberSlots(input({ earliestStart: at(8, 20) + 120 * 60_000 }));
    expect(times(slots)).toEqual(["10:30"]);
  });

  it("alinea a la grilla del reloj si el turno empieza en un minuto raro", () => {
    const slots = computeBarberSlots(input({ shifts: [{ startMinute: h(9, 10), endMinute: h(10) }] }));
    expect(times(slots)).toEqual(["09:15", "09:30"]);
  });

  it("recorta el turno al horario de atención del local", () => {
    const slots = computeBarberSlots(
      input({
        shifts: [{ startMinute: h(8), endMinute: h(21) }],
        day: { closed: false, openMinute: h(19), closeMinute: h(20) },
      }),
    );
    expect(times(slots)).toEqual(["19:00", "19:15", "19:30"]);
  });

  it("combina turnos partidos", () => {
    const slots = computeBarberSlots(
      input({
        shifts: [
          { startMinute: h(9), endMinute: h(10) },
          { startMinute: h(14), endMinute: h(15) },
        ],
      }),
    );
    expect(times(slots)).toEqual(["09:00", "09:15", "09:30", "14:00", "14:15", "14:30"]);
  });

  it("devuelve los horarios ordenados aunque los turnos lleguen desordenados o se solapen", () => {
    const slots = computeBarberSlots(
      input({
        shifts: [
          { startMinute: h(10), endMinute: h(11) },
          { startMinute: h(9), endMinute: h(10, 30) },
        ],
      }),
    );
    expect(times(slots)).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30"]);
  });

  it("funciona con otro intervalo (30 min)", () => {
    expect(times(computeBarberSlots(input({ intervalMin: 30 })))).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });

  it("los horarios corresponden a la hora de Bogotá (UTC-5)", () => {
    const [first] = computeBarberSlots(input());
    expect(zonedToUtc(DATE, first, TZ).toISOString()).toBe("2026-11-10T14:00:00.000Z");
  });
});

describe("mergeBarberSlots ('cualquiera disponible')", () => {
  it("une los horarios y lista qué barberos están libres en cada uno", () => {
    const merged = mergeBarberSlots(
      new Map([
        ["carlos", [h(9), h(9, 15)]],
        ["andres", [h(9, 15), h(10)]],
      ]),
    );
    expect([...merged.keys()].map(formatMinute)).toEqual(["09:00", "09:15", "10:00"]);
    expect(merged.get(h(9, 15))).toEqual(["carlos", "andres"]);
  });
});

describe("pickLeastBusyBarber", () => {
  it("elige al barbero con menos citas ese día", () => {
    expect(
      pickLeastBusyBarber([
        { id: "a", sortOrder: 0, appointmentsThatDay: 5 },
        { id: "b", sortOrder: 1, appointmentsThatDay: 2 },
      ]),
    ).toBe("b");
  });

  it("en empate usa el orden configurado", () => {
    expect(
      pickLeastBusyBarber([
        { id: "a", sortOrder: 2, appointmentsThatDay: 1 },
        { id: "b", sortOrder: 1, appointmentsThatDay: 1 },
      ]),
    ).toBe("b");
  });

  it("devuelve null sin candidatos", () => {
    expect(pickLeastBusyBarber([])).toBeNull();
  });
});
