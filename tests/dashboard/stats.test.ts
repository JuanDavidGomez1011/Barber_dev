import { describe, expect, it } from "vitest";
import { computeDashboard, type StatAppointment, type Status } from "@/lib/dashboard/stats";
import { zonedToUtc } from "@/lib/time";

const TZ = "America/Bogota";
const ref = {
  now: zonedToUtc("2026-11-11", 12 * 60, TZ), // miércoles 11, mediodía
  today: "2026-11-11",
  weekStart: "2026-11-09", // lunes
  timezone: TZ,
};
const appt = (date: string, hour: number, status: Status, priceCop = 25000, serviceName = "Corte"): StatAppointment => ({
  startsAt: zonedToUtc(date, hour * 60, TZ),
  status,
  priceCop,
  serviceName,
});

describe("computeDashboard", () => {
  it("cuenta las citas de hoy por estado (canceladas aparte)", () => {
    const s = computeDashboard(
      [
        appt("2026-11-11", 9, "COMPLETED"),
        appt("2026-11-11", 10, "NO_SHOW"),
        appt("2026-11-11", 15, "CONFIRMED"),
        appt("2026-11-11", 16, "CANCELLED"),
        appt("2026-11-10", 9, "COMPLETED"),
      ],
      ref,
    );
    expect(s.today).toEqual({ total: 3, pending: 1, completed: 1, noShow: 1, cancelled: 1 });
  });

  it("los ingresos estimados de la semana suman confirmadas y completadas, no inasistencias ni canceladas", () => {
    const s = computeDashboard(
      [
        appt("2026-11-09", 9, "COMPLETED", 25000),
        appt("2026-11-12", 9, "CONFIRMED", 40000),
        appt("2026-11-12", 10, "NO_SHOW", 18000),
        appt("2026-11-15", 10, "CANCELLED", 30000),
        appt("2026-11-16", 10, "CONFIRMED", 99000), // semana siguiente
      ],
      ref,
    );
    expect(s.week.estimatedIncome).toBe(65000);
    expect(s.week.completedIncome).toBe(25000);
    expect(s.week.appointments).toBe(2);
  });

  it("reparte la semana en 7 días (lunes a domingo), incluidos los vacíos", () => {
    const s = computeDashboard([appt("2026-11-12", 9, "CONFIRMED"), appt("2026-11-12", 11, "COMPLETED")], ref);
    expect(s.week.perDay.map((d) => d.date)).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
    ]);
    expect(s.week.perDay[3]).toEqual({ date: "2026-11-12", count: 2, income: 50000 });
    expect(s.week.perDay[0].count).toBe(0);
  });

  it("una cita a las 8 p. m. en Bogotá cuenta para ese día, no para el siguiente en UTC", () => {
    const s = computeDashboard([appt("2026-11-11", 20, "CONFIRMED")], ref);
    expect(s.today.total).toBe(1);
  });

  it("ordena los servicios más pedidos de los últimos 30 días, sin canceladas", () => {
    const s = computeDashboard(
      [
        appt("2026-11-01", 9, "COMPLETED", 0, "Barba"),
        appt("2026-11-02", 9, "COMPLETED", 0, "Corte"),
        appt("2026-11-03", 9, "NO_SHOW", 0, "Corte"),
        appt("2026-11-04", 9, "CANCELLED", 0, "Barba"),
        appt("2026-11-04", 10, "CANCELLED", 0, "Barba"),
        appt("2026-09-01", 9, "COMPLETED", 0, "Barba"), // hace más de 30 días
      ],
      ref,
    );
    expect(s.topServices).toEqual([
      { name: "Corte", count: 2 },
      { name: "Barba", count: 1 },
    ]);
  });

  it("tasa de inasistencia = no asistió / (completadas + no asistió), solo citas pasadas", () => {
    const s = computeDashboard(
      [
        appt("2026-11-05", 9, "COMPLETED"),
        appt("2026-11-06", 9, "COMPLETED"),
        appt("2026-11-07", 9, "COMPLETED"),
        appt("2026-11-08", 9, "NO_SHOW"),
        appt("2026-11-11", 15, "CONFIRMED"), // futura: no cuenta
        appt("2026-11-10", 9, "CANCELLED"), // cancelada: no cuenta
      ],
      ref,
    );
    expect(s.noShow).toEqual({ rate: 0.25, noShows: 1, attended: 3 });
  });

  it("sin citas pasadas la tasa es null (no 0 %)", () => {
    expect(computeDashboard([], ref).noShow.rate).toBeNull();
  });
});
