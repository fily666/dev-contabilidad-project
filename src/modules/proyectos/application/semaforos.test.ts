import { describe, expect, it } from "vitest";

import { RelojFijo } from "@/shared/testing/reloj-fijo";
import { DashboardRepositoryEnMemoria } from "@/modules/dashboard/application/dobles";
import { ObligacionRepositoryEnMemoria } from "@/modules/obligaciones/application/dobles";
import { Obligacion } from "@/modules/obligaciones/domain/obligacion.entity";
import { PresupuestoRepositoryEnMemoria } from "@/modules/presupuestos/application/dobles";

import { ObtenerSemaforos } from "./obtener-semaforos.use-case";
import { TipoProyectoRepositoryEnMemoria, TIPO_INMUEBLE, TIPO_VEHICULO } from "./dobles";

/**
 * Contexto.md §5.5 y §3: el semáforo es indicador exigido de los dos escenarios de
 * referencia. `calcularEstadoFinanciero` ya estaba probada; lo que estas pruebas
 * cubren es el cableado, que es donde estaba el hueco: reunir las señales sin
 * inventar ninguna.
 */

const HOY = "2026-07-30";

const INMUEBLE = { proyectoId: "p-inmueble", tipoProyectoId: TIPO_INMUEBLE.id };
const VEHICULO = { proyectoId: "p-vehiculo", tipoProyectoId: TIPO_VEHICULO.id };

function montar() {
  const dashboard = new DashboardRepositoryEnMemoria();
  const obligaciones = new ObligacionRepositoryEnMemoria();
  obligaciones.hoy = HOY;
  const presupuestos = new PresupuestoRepositoryEnMemoria();
  const tipos = new TipoProyectoRepositoryEnMemoria();

  return {
    dashboard,
    obligaciones,
    presupuestos,
    semaforos: new ObtenerSemaforos(
      dashboard,
      obligaciones,
      presupuestos,
      tipos,
      new RelojFijo(HOY),
    ),
  };
}

async function conVencimiento(
  obligaciones: ObligacionRepositoryEnMemoria,
  proyectoId: string,
  fechaVencimiento: string,
) {
  await obligaciones.guardar(
    Obligacion.crear({
      id: `0b000000-0000-4000-8000-0000000000${proyectoId.length}`,
      proyectoId,
      categoriaId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
      concepto: "Administración",
      valorEstimado: 100_000,
      fechaVencimiento,
      frecuencia: "unica",
    }),
  );
  await obligaciones.generarOcurrencias(1);
  await obligaciones.marcarVencidos();
}

describe("ObtenerSemaforos", () => {
  it("sin proyectos no consulta nada", async () => {
    const { semaforos, dashboard } = montar();

    expect(await semaforos.ejecutar([])).toEqual(new Map());
    expect(dashboard.mesesRecibidos).toEqual([]);
  });

  it("sin señales adversas el proyecto está saludable", async () => {
    const { semaforos } = montar();

    const resultado = await semaforos.ejecutar([INMUEBLE]);

    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("saludable");
  });

  it("una obligación vencida pone el proyecto en riesgo", async () => {
    const { semaforos, obligaciones } = montar();
    await conVencimiento(obligaciones, INMUEBLE.proyectoId, "2026-06-01");

    const resultado = await semaforos.ejecutar([INMUEBLE]);

    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("riesgo");
  });

  /** Lo vencido de OTRO proyecto no puede contaminar este. */
  it("las señales no se cruzan entre proyectos", async () => {
    const { semaforos, obligaciones } = montar();
    await conVencimiento(obligaciones, VEHICULO.proyectoId, "2026-06-01");

    const resultado = await semaforos.ejecutar([INMUEBLE, VEHICULO]);

    expect(resultado.get(VEHICULO.proyectoId)?.estado).toBe("riesgo");
    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("saludable");
  });

  it("la ventana de flujo se ancla a hoy, no al rango que se esté consultando", async () => {
    const { semaforos, dashboard } = montar();

    await semaforos.ejecutar([INMUEBLE]);

    // Tres meses cerrados en julio de 2026 ⇒ desde el 1 de mayo.
    expect(dashboard.mesesRecibidos).toEqual(["2026-05-01"]);
  });

  it("flujo negativo pone en riesgo a un proyecto que debería generar ingresos", async () => {
    const { semaforos, dashboard } = montar();
    dashboard.flujoReciente = [{ proyectoId: INMUEBLE.proyectoId, flujoNeto: -500_000 }];

    const resultado = await semaforos.ejecutar([INMUEBLE]);

    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("riesgo");
  });

  /**
   * La regla de §5.4 que evita el falso positivo más obvio: un vehículo no genera
   * ingresos por diseño, así que su flujo es negativo todos los meses. Sin esta
   * distinción, cada moto del sistema aparecería «en riesgo» de forma permanente y
   * el semáforo dejaría de significar algo.
   */
  it("flujo negativo NO penaliza a un tipo que no genera ingresos", async () => {
    const { semaforos, dashboard } = montar();
    dashboard.flujoReciente = [{ proyectoId: VEHICULO.proyectoId, flujoNeto: -500_000 }];

    const resultado = await semaforos.ejecutar([VEHICULO]);

    expect(resultado.get(VEHICULO.proyectoId)?.estado).toBe("saludable");
  });

  it("un presupuesto excedido pone en riesgo", async () => {
    const { semaforos, presupuestos } = montar();
    presupuestos.ejecucionDeclarada = [
      ejecucionDe({ proyectoId: INMUEBLE.proyectoId, valorPlaneado: 100, valorReal: 130 }),
    ];

    const resultado = await semaforos.ejecutar([INMUEBLE]);

    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("riesgo");
  });

  it("por encima del 80 % queda en observación", async () => {
    const { semaforos, presupuestos } = montar();
    presupuestos.ejecucionDeclarada = [
      ejecucionDe({ proyectoId: INMUEBLE.proyectoId, valorPlaneado: 100, valorReal: 85 }),
    ];

    const resultado = await semaforos.ejecutar([INMUEBLE]);

    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("observacion");
  });

  /**
   * El máximo y no el promedio: tres partidas al 20 % y una al 130 % dan un
   * promedio sano y esconden exactamente lo que hay que ver.
   */
  it("se mira la partida más ejecutada, no el promedio", async () => {
    const { semaforos, presupuestos } = montar();
    presupuestos.ejecucionDeclarada = [
      ejecucionDe({ proyectoId: INMUEBLE.proyectoId, valorPlaneado: 100, valorReal: 20 }),
      ejecucionDe({ proyectoId: INMUEBLE.proyectoId, valorPlaneado: 100, valorReal: 20 }),
      ejecucionDe({ proyectoId: INMUEBLE.proyectoId, valorPlaneado: 100, valorReal: 130 }),
    ];

    const resultado = await semaforos.ejecutar([INMUEBLE]);

    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("riesgo");
  });

  it("un presupuesto global aplica a todos los proyectos", async () => {
    const { semaforos, presupuestos } = montar();
    presupuestos.ejecucionDeclarada = [
      ejecucionDe({ proyectoId: null, valorPlaneado: 100, valorReal: 130 }),
    ];

    const resultado = await semaforos.ejecutar([INMUEBLE, VEHICULO]);

    expect(resultado.get(INMUEBLE.proyectoId)?.estado).toBe("riesgo");
    expect(resultado.get(VEHICULO.proyectoId)?.estado).toBe("riesgo");
  });

  it("solo se consultan los presupuestos vigentes hoy", async () => {
    const { semaforos, presupuestos } = montar();

    await semaforos.ejecutar([INMUEBLE]);

    expect(presupuestos.filtrosRecibidos).toContainEqual({ vigenteEn: HOY });
  });

  it("sin presupuesto la señal no existe, y eso no es «saludable por ignorancia»", async () => {
    const { semaforos } = montar();

    const resultado = await semaforos.ejecutar([INMUEBLE]);

    // Sin presupuesto no hay desviación que reprochar, pero tampoco se afirma
    // nada sobre él: el motivo habla de lo que sí se comprobó.
    expect(resultado.get(INMUEBLE.proyectoId)?.motivo).toContain("Sin obligaciones vencidas");
  });
});

let secuencia = 0;

function ejecucionDe(entrada: {
  proyectoId: string | null;
  valorPlaneado: number;
  valorReal: number;
}) {
  secuencia += 1;
  return {
    presupuestoId: `pr-${secuencia}`,
    proyectoId: entrada.proyectoId,
    proyecto: entrada.proyectoId ? "Proyecto" : null,
    categoriaId: "c1",
    categoria: "Administración",
    naturaleza: "opex" as const,
    periodoInicio: "2026-07-01",
    periodoFin: "2026-07-31",
    valorPlaneado: entrada.valorPlaneado,
    valorReal: entrada.valorReal,
    desviacion: entrada.valorReal - entrada.valorPlaneado,
    ejecucion: entrada.valorPlaneado > 0 ? entrada.valorReal / entrada.valorPlaneado : null,
    movimientos: 1,
    moneda: "COP",
  };
}
