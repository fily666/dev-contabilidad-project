import { describe, expect, it } from "vitest";

import { nivelDeAlerta, ritmoDeEjecucion } from "./alertas";

/** Contexto.md RF-82 y la guarda de §5.3. */

describe("nivelDeAlerta", () => {
  it("clasifica por los umbrales de RF-82", () => {
    expect(nivelDeAlerta(0.5)).toBe("ok");
    expect(nivelDeAlerta(0.8)).toBe("aviso");
    expect(nivelDeAlerta(0.99)).toBe("aviso");
    expect(nivelDeAlerta(1)).toBe("excedido");
    expect(nivelDeAlerta(1.4)).toBe("excedido");
  });

  it("sin ejecucion calculable no hay alerta, ni buena ni mala", () => {
    expect(nivelDeAlerta(null)).toBeNull();
    expect(nivelDeAlerta(Number.NaN)).toBeNull();
    expect(nivelDeAlerta(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

/**
 * El ritmo es la medida que faltaba: un 60 % de ejecución no dice nada por sí
 * solo, porque en octubre es sano y en marzo es una alarma.
 */
describe("ritmoDeEjecucion", () => {
  const periodo = { periodoInicio: "2026-01-01", periodoFin: "2026-12-31" };

  it("gastar al paso del calendario da un ritmo de 1", () => {
    // A mitad de año, la mitad ejecutada: exactamente al día.
    const ritmo = ritmoDeEjecucion({ ...periodo, ejecucion: 0.5, hoy: "2026-07-02" });

    expect(ritmo).toBeCloseTo(1, 1);
  });

  it("60 % en marzo es ir muy rapido; 60 % en octubre es ir bien", () => {
    const marzo = ritmoDeEjecucion({ ...periodo, ejecucion: 0.6, hoy: "2026-03-01" });
    const octubre = ritmoDeEjecucion({ ...periodo, ejecucion: 0.6, hoy: "2026-10-01" });

    expect(marzo).toBeGreaterThan(2);
    expect(octubre).toBeCloseTo(0.8, 1);
    // Es el mismo porcentaje de ejecución: lo que cambia es el momento.
    expect(marzo).toBeGreaterThan(octubre!);
  });

  it("sin ejecucion calculable no hay ritmo", () => {
    expect(ritmoDeEjecucion({ ...periodo, ejecucion: null, hoy: "2026-06-01" })).toBeNull();
  });

  it("antes de empezar el periodo no hay ritmo: no se puede ir rapido sin empezar", () => {
    expect(ritmoDeEjecucion({ ...periodo, ejecucion: 0.2, hoy: "2025-12-15" })).toBeNull();
  });

  it("despues de terminar tampoco: ahi la cifra que importa es la ejecucion final", () => {
    expect(ritmoDeEjecucion({ ...periodo, ejecucion: 0.9, hoy: "2027-01-05" })).toBeNull();
  });

  it("un periodo de un solo dia no divide por cero", () => {
    const ritmo = ritmoDeEjecucion({
      periodoInicio: "2026-06-01",
      periodoFin: "2026-06-01",
      ejecucion: 0.5,
      hoy: "2026-06-01",
    });

    expect(ritmo).toBeNull();
  });

  it("el primer dia del periodo no da un ritmo infinito", () => {
    const ritmo = ritmoDeEjecucion({ ...periodo, ejecucion: 0.1, hoy: "2026-01-01" });

    expect(ritmo).not.toBeNull();
    expect(Number.isFinite(ritmo!)).toBe(true);
  });
});
