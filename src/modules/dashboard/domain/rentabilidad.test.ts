import { describe, expect, it } from "vitest";
import { evolucionDeGastos, rentabilidadPorProyecto } from "./rentabilidad";

/** Contexto.md RF-74, RF-75, §5.3. */

const BASE = {
  estado: "activo" as const,
  moneda: "COP",
};

describe("rentabilidadPorProyecto (RF-74)", () => {
  it("excluye los proyectos sin ingresos: no son comparables (§5.4)", () => {
    const filas = rentabilidadPorProyecto([
      {
        ...BASE,
        proyectoId: "p1",
        nombre: "Apartamento",
        totalInvertido: 100_000_000,
        totalIngresos: 24_000_000,
        totalEgresos: 30_000_000,
        balance: -6_000_000,
      },
      {
        ...BASE,
        proyectoId: "p2",
        nombre: "Moto",
        totalInvertido: 18_000_000,
        totalIngresos: 0,
        totalEgresos: 20_000_000,
        balance: -20_000_000,
      },
    ]);

    expect(filas.map((f) => f.proyectoId)).toEqual(["p1"]);
  });

  it("el ROI es (ingresos − egresos) / invertido", () => {
    const [fila] = rentabilidadPorProyecto([
      {
        ...BASE,
        proyectoId: "p1",
        nombre: "Apartamento",
        totalInvertido: 100_000_000,
        totalIngresos: 30_000_000,
        totalEgresos: 10_000_000,
        balance: 20_000_000,
      },
    ]);

    expect(fila?.roi).toBeCloseTo(0.2, 6);
  });

  it("sin inversion el ROI es null, nunca infinito (guarda §5.3)", () => {
    const [fila] = rentabilidadPorProyecto([
      {
        ...BASE,
        proyectoId: "p1",
        nombre: "Negocio sin capex",
        totalInvertido: 0,
        totalIngresos: 5_000_000,
        totalEgresos: 1_000_000,
        balance: 4_000_000,
      },
    ]);

    expect(fila?.roi).toBeNull();
  });

  it("ordena de mayor a menor rentabilidad", () => {
    const filas = rentabilidadPorProyecto([
      {
        ...BASE,
        proyectoId: "bajo",
        nombre: "Bajo",
        totalInvertido: 100,
        totalIngresos: 10,
        totalEgresos: 5,
        balance: 5,
      },
      {
        ...BASE,
        proyectoId: "alto",
        nombre: "Alto",
        totalInvertido: 100,
        totalIngresos: 60,
        totalEgresos: 5,
        balance: 55,
      },
    ]);

    expect(filas.map((f) => f.proyectoId)).toEqual(["alto", "bajo"]);
  });
});

describe("evolucionDeGastos (RF-75)", () => {
  it("acumula en orden cronologico aunque la serie llegue desordenada", () => {
    const serie = evolucionDeGastos([
      { mes: "2026-03-01", egresos: 300 },
      { mes: "2026-01-01", egresos: 100 },
      { mes: "2026-02-01", egresos: 200 },
    ]);

    expect(serie.map((p) => p.mes)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(serie.map((p) => p.acumulado)).toEqual([100, 300, 600]);
  });

  it("una serie vacia no revienta ni inventa puntos", () => {
    expect(evolucionDeGastos([])).toEqual([]);
  });
});
