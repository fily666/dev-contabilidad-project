import { describe, expect, it } from "vitest";

import { consolidar, ltvDelProyecto, plusvaliaDelProyecto } from "./consolidado";
import type { PatrimonioProyecto } from "./patrimonio.repository";

/** Contexto.md RF-78 y la guarda de §5.3. */

function fila(parciales: Partial<PatrimonioProyecto> = {}): PatrimonioProyecto {
  return {
    proyectoId: "p1",
    proyecto: "Apartamento 402",
    estado: "activo",
    moneda: "COP",
    valoracionActual: 320_000_000,
    valoracionFecha: "2026-07-01",
    pasivoTotal: 148_000_000,
    patrimonioNeto: 172_000_000,
    totalInvertido: 210_000_000,
    totalIngresos: 40_000_000,
    totalEgresos: 30_000_000,
    ...parciales,
  };
}

describe("plusvaliaDelProyecto", () => {
  it("es la valoracion menos lo invertido", () => {
    expect(plusvaliaDelProyecto(fila())).toBe(110_000_000);
  });

  it("puede ser negativa: un vehiculo se deprecia", () => {
    expect(
      plusvaliaDelProyecto(fila({ valoracionActual: 12_000_000, totalInvertido: 18_400_000 })),
    ).toBe(-6_400_000);
  });

  /**
   * Sin valoración no hay plusvalía que medir. Devolver 0 diría «no se ha
   * valorizado», que es una afirmación distinta de «no lo sabemos».
   */
  it("sin valoracion es null, no cero", () => {
    expect(plusvaliaDelProyecto(fila({ valoracionActual: null }))).toBeNull();
  });
});

describe("ltvDelProyecto", () => {
  it("es el pasivo sobre la valoracion", () => {
    expect(ltvDelProyecto(fila())).toBeCloseTo(0.4625, 4);
  });

  it("sin deuda da cero, que si es una respuesta", () => {
    expect(ltvDelProyecto(fila({ pasivoTotal: 0 }))).toBe(0);
  });

  it("sin valoracion es null: no hay base sobre la que medir", () => {
    expect(ltvDelProyecto(fila({ valoracionActual: null }))).toBeNull();
  });

  it("con valoracion en cero es null y no infinito (§5.3)", () => {
    expect(ltvDelProyecto(fila({ valoracionActual: 0 }))).toBeNull();
  });
});

describe("consolidar", () => {
  it("expone plusvalia y LTV del conjunto", () => {
    const consolidado = consolidar([fila()]);

    expect(consolidado.plusvalia).toBe(110_000_000);
    expect(consolidado.ltv).toBeCloseTo(0.4625, 4);
  });

  /**
   * El proyecto sin valoración no aporta activo ni plusvalía, y eso se cuenta:
   * si su inversión entrara en la base, la plusvalía consolidada sería una resta
   * inventada.
   */
  it("los proyectos sin valoracion no entran en la plusvalia ni en el LTV", () => {
    const consolidado = consolidar([
      fila(),
      fila({ proyectoId: "p2", valoracionActual: null, totalInvertido: 50_000_000 }),
    ]);

    expect(consolidado.plusvalia).toBe(110_000_000);
    expect(consolidado.sinValoracion).toBe(1);
  });

  it("sin ninguna valoracion el LTV es null", () => {
    const consolidado = consolidar([fila({ valoracionActual: null })]);

    expect(consolidado.ltv).toBeNull();
    expect(consolidado.plusvalia).toBe(0);
  });
});
