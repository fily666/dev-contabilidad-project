import { describe, expect, it } from "vitest";
import { RelojFijo } from "@/shared/testing/reloj-fijo";
import {
  ProyectoRepositoryEnMemoria,
  proyectoDePrueba,
} from "@/modules/proyectos/application/dobles";
import { ObligacionRepositoryEnMemoria } from "@/modules/obligaciones/application/dobles";
import { Obligacion } from "@/modules/obligaciones/domain/obligacion.entity";

import { ObtenerPanel } from "./obtener-panel.use-case";
import { DashboardRepositoryEnMemoria } from "./dobles";

/** Contexto.md §8.8: composicion del panel (RF-70 a RF-79). */

const HOY = "2026-07-30";

function montar() {
  const dashboard = new DashboardRepositoryEnMemoria();
  const proyectos = new ProyectoRepositoryEnMemoria();
  const obligaciones = new ObligacionRepositoryEnMemoria();
  obligaciones.hoy = HOY;
  const reloj = new RelojFijo(HOY);

  return {
    dashboard,
    proyectos,
    obligaciones,
    panel: new ObtenerPanel(dashboard, proyectos, obligaciones, reloj),
  };
}

describe("ObtenerPanel", () => {
  it("el rango por omision son los ultimos doce meses (RF-71)", () => {
    const { panel } = montar();

    expect(panel.rangoPorOmision()).toEqual({ desde: "2025-08-01", hasta: HOY });
  });

  it("propaga el filtro a las cifras ejecutadas", async () => {
    const { panel, dashboard } = montar();

    await panel.ejecutar({
      filtro: { proyectoId: "p1", desde: "2026-01-01", hasta: "2026-06-30" },
    });

    expect(dashboard.filtrosRecibidos[0]).toEqual({
      proyectoId: "p1",
      desde: "2026-01-01",
      hasta: "2026-06-30",
    });
  });

  it("la proyeccion NO se recorta al rango consultado", async () => {
    const { panel, dashboard } = montar();

    await panel.ejecutar({
      filtro: { proyectoId: "p1", desde: "2025-01-01", hasta: "2025-12-31" },
    });

    // Lo que vence el mes que viene sigue importando aunque se este mirando 2025.
    expect(dashboard.filtrosRecibidos).toContainEqual({ proyectoId: "p1" });
  });

  it("separa vencidas de proximos pagos (RF-73)", async () => {
    const { panel, obligaciones, proyectos } = montar();
    const proyecto = proyectoDePrueba();
    await proyectos.guardar(proyecto);

    const obligacion = Obligacion.crear({
      id: "0b000000-0000-4000-8000-000000000001",
      proyectoId: proyecto.id,
      categoriaId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
      concepto: "Administración",
      valorEstimado: 100_000,
      fechaVencimiento: "2026-06-05",
      frecuencia: "mensual",
    });
    await obligaciones.guardar(obligacion);
    await obligaciones.generarOcurrencias(2);
    await obligaciones.marcarVencidos();

    const resultado = await panel.ejecutar({});

    expect(resultado.obligacionesVencidas.length).toBeGreaterThan(0);
    expect(resultado.obligacionesVencidas.every((e) => e.diasRestantes < 0)).toBe(true);
    expect(resultado.proximosPagos.every((e) => e.diasRestantes >= 0)).toBe(true);
  });

  it("cuenta los proyectos activos y calcula la rentabilidad solo con ingresos", async () => {
    const { panel, proyectos, dashboard } = montar();
    await proyectos.guardar(proyectoDePrueba({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }));
    await proyectos.guardar(
      proyectoDePrueba({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", estado: "pausado" }),
    );
    dashboard.totales = { ...dashboard.totales, totalIngresos: 10, totalEgresos: 4, balance: 6 };

    const resultado = await panel.ejecutar({});

    expect(resultado.proyectos).toHaveLength(2);
    expect(resultado.proyectosActivos).toBe(1);
    // El doble de proyectos devuelve cifras en cero: sin ingresos no hay filas.
    expect(resultado.rentabilidad).toHaveLength(0);
    expect(resultado.totales.balance).toBe(6);
  });

  it("con un proyecto en el filtro, el resumen se limita a ese proyecto (RF-79)", async () => {
    const { panel, proyectos } = montar();
    await proyectos.guardar(proyectoDePrueba({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }));
    await proyectos.guardar(proyectoDePrueba({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2" }));

    const resultado = await panel.ejecutar({
      filtro: { proyectoId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2" },
    });

    expect(resultado.proyectos.map((p) => p.proyectoId)).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    ]);
  });

  it("acumula el flujo y la evolucion del gasto a partir de la serie mensual", async () => {
    const { panel, dashboard } = montar();
    dashboard.flujo = [
      { mes: "2026-01-01", ingresos: 100, egresos: 40, flujoNeto: 60 },
      { mes: "2026-02-01", ingresos: 0, egresos: 60, flujoNeto: -60 },
    ];

    const resultado = await panel.ejecutar({});

    expect(resultado.flujoAcumulado.map((p) => p.acumulado)).toEqual([60, 0]);
    expect(resultado.evolucionGastos.map((p) => p.acumulado)).toEqual([40, 100]);
  });
});
