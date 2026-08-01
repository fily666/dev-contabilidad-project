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

  /**
   * El defecto que estas tres pruebas cierran: el panel presentaba las cifras de
   * cada proyecto tomadas del resumen historico junto a los totales del rango,
   * con las mismas etiquetas. «Total invertido» arriba y «Invertido» en la
   * tarjeta significaban cosas distintas y nada lo decia.
   */
  describe("todas las cifras del panel son del rango (RF-79)", () => {
    const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";

    it("las cifras por proyecto salen del rango, no del historico", async () => {
      const { panel, proyectos, dashboard } = montar();
      await proyectos.guardar(proyectoDePrueba({ id: P1 }));
      // Lo que diria v_resumen_proyecto: toda la historia.
      proyectos.historico.set(P1, {
        totalInvertido: 900,
        totalIngresos: 800,
        totalEgresos: 950,
        balance: -150,
      });
      // Lo que de verdad ocurrio dentro del rango consultado.
      dashboard.porProyecto = [
        {
          proyectoId: P1,
          totalInvertido: 100,
          totalGastosOperativos: 20,
          totalFinanciacion: 0,
          totalIngresos: 300,
          totalEgresos: 120,
          balance: 180,
        },
      ];

      const resultado = await panel.ejecutar({
        filtro: { desde: "2026-01-01", hasta: "2026-06-30" },
      });

      expect(resultado.proyectos[0]).toMatchObject({
        totalInvertido: 100,
        totalIngresos: 300,
        totalEgresos: 120,
        balance: 180,
      });
    });

    it("un proyecto sin movimientos en el rango queda en cero, no en su historico", async () => {
      const { panel, proyectos } = montar();
      await proyectos.guardar(proyectoDePrueba({ id: P1 }));
      proyectos.historico.set(P1, { totalInvertido: 900, totalIngresos: 800 });
      // dashboard.porProyecto queda vacio: nada pagado en el rango.

      const resultado = await panel.ejecutar({
        filtro: { desde: "2020-01-01", hasta: "2020-12-31" },
      });

      expect(resultado.proyectos[0]).toMatchObject({ totalInvertido: 0, totalIngresos: 0 });
    });

    it("conserva ultimoMovimiento, que es de la historia y no del rango", async () => {
      const { panel, proyectos } = montar();
      await proyectos.guardar(proyectoDePrueba({ id: P1 }));
      proyectos.historico.set(P1, { ultimoMovimiento: "2026-07-12" });

      const resultado = await panel.ejecutar({
        filtro: { desde: "2020-01-01", hasta: "2020-12-31" },
      });

      // Acotarlo diria «sin movimientos» de un proyecto que si los tiene.
      expect(resultado.proyectos[0]!.ultimoMovimiento).toBe("2026-07-12");
    });

    it("la rentabilidad se calcula sobre las cifras del rango", async () => {
      const { panel, proyectos, dashboard } = montar();
      await proyectos.guardar(proyectoDePrueba({ id: P1 }));
      // Sin ingresos historicos no habria fila; con ingresos en el rango, si.
      dashboard.porProyecto = [
        {
          proyectoId: P1,
          totalInvertido: 100,
          totalGastosOperativos: 0,
          totalFinanciacion: 0,
          totalIngresos: 150,
          totalEgresos: 100,
          balance: 50,
        },
      ];

      const resultado = await panel.ejecutar({});

      expect(resultado.rentabilidad).toHaveLength(1);
      expect(resultado.rentabilidad[0]!.roi).toBeCloseTo(0.5);
    });
  });

  /**
   * «¿Qué cambió?» es una de las tres preguntas que un panel debe responder, y era
   * la única que no se respondía en ninguna parte del producto.
   */
  describe("variacion frente al periodo anterior (RF-70)", () => {
    it("compara con el periodo inmediatamente anterior de igual longitud en meses", async () => {
      const { panel, dashboard } = montar();

      await panel.ejecutar({ filtro: { desde: "2026-04-01", hasta: "2026-06-30" } });

      // Tres meses consultados ⇒ los tres meses anteriores, completos.
      expect(dashboard.filtrosRecibidos).toContainEqual({
        proyectoId: undefined,
        desde: "2026-01-01",
        hasta: "2026-03-31",
      });
    });

    it("cuenta en meses y no en dias, porque las vistas agregan por mes", async () => {
      const { panel, dashboard } = montar();

      // Un rango de doce meses debe compararse con los doce anteriores.
      await panel.ejecutar({ filtro: { desde: "2026-01-01", hasta: "2026-12-31" } });

      expect(dashboard.filtrosRecibidos).toContainEqual({
        proyectoId: undefined,
        desde: "2025-01-01",
        hasta: "2025-12-31",
      });
    });

    it("propaga el proyecto del filtro a la comparacion", async () => {
      const { panel, dashboard } = montar();

      await panel.ejecutar({
        filtro: { proyectoId: "p1", desde: "2026-06-01", hasta: "2026-06-30" },
      });

      expect(dashboard.filtrosRecibidos).toContainEqual({
        proyectoId: "p1",
        desde: "2026-05-01",
        hasta: "2026-05-31",
      });
    });

    it("sin rango no hay con que comparar y la variacion queda vacia", async () => {
      const { panel } = montar();

      const resultado = await panel.ejecutar({});

      expect(resultado.variacion.periodoAnterior).toBeNull();
      expect(resultado.variacion.totalIngresos).toBeNull();
    });

    it("con periodo anterior en cero la variacion es null, no un porcentaje inventado", async () => {
      const { panel, dashboard } = montar();
      // El doble devuelve los mismos totales para los dos periodos; con ceros en
      // la base, §5.3 exige «—» y no «+100 %».
      dashboard.totales = { ...dashboard.totales, totalIngresos: 0, totalEgresos: 0, balance: 0 };

      const resultado = await panel.ejecutar({
        filtro: { desde: "2026-06-01", hasta: "2026-06-30" },
      });

      expect(resultado.variacion.totalIngresos).toBeNull();
      expect(resultado.variacion.balance).toBeNull();
    });

    it("calcula el tanto por uno cuando la base no es cero", async () => {
      const { panel, dashboard } = montar();
      dashboard.totales = { ...dashboard.totales, totalIngresos: 150, totalEgresos: 50 };

      const resultado = await panel.ejecutar({
        filtro: { desde: "2026-06-01", hasta: "2026-06-30" },
      });

      // Mismo doble para los dos periodos ⇒ variación nula, no null.
      expect(resultado.variacion.totalIngresos).toBe(0);
    });
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
