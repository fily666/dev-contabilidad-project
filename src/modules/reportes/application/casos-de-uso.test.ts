import { describe, expect, it } from "vitest";
import { RelojFijo } from "@/shared/testing/reloj-fijo";
import {
  CategoriaRepositoryEnMemoria,
  categoriaDePrueba,
} from "@/modules/categorias/application/dobles";
import {
  ID_TRANSFERENCIA,
  MetodoPagoRepositoryEnMemoria,
  metodoTransferencia,
} from "@/modules/metodos-pago/application/dobles";
import {
  ProyectoRepositoryEnMemoria,
  proyectoDePrueba,
} from "@/modules/proyectos/application/dobles";
import { MovimientoRepositoryEnMemoria } from "@/modules/movimientos/application/dobles";
import { ListarMovimientos } from "@/modules/movimientos/application/listar-movimientos.use-case";
import { RegistrarMovimiento } from "@/modules/movimientos/application/registrar-movimiento.use-case";
import { ObligacionRepositoryEnMemoria } from "@/modules/obligaciones/application/dobles";
import { Obligacion } from "@/modules/obligaciones/domain/obligacion.entity";
import { DashboardRepositoryEnMemoria } from "@/modules/dashboard/application/dobles";

import type { GeneradorExcel, GeneradorPdf } from "../domain/exportadores";
import { MAXIMO_FILAS_EXPORTACION, type Reporte } from "../domain/reporte";
import {
  ExportarReporte,
  ReporteEstadoFinanciero,
  ReporteFlujoCaja,
  ReporteMovimientos,
  ReporteObligaciones,
} from "./casos-de-uso";

/** Contexto.md §8.8: reportes y exportacion (RF-90 a RF-95, §11). */

const CAPEX = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const INGRESO = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const HOY = "2026-07-30";

class GeneradorFalso implements GeneradorExcel, GeneradorPdf {
  recibidos: Reporte[] = [];

  async generar(reporte: Reporte): Promise<Uint8Array> {
    this.recibidos.push(reporte);
    return new TextEncoder().encode(`${reporte.tipo}:${reporte.filas.length}`);
  }
}

function montar() {
  const proyecto = proyectoDePrueba({ nombre: "Apartamento Chapinero" });
  const proyectos = new ProyectoRepositoryEnMemoria();
  proyectos.filas.set(proyecto.id, proyecto);

  const categorias = new CategoriaRepositoryEnMemoria([
    categoriaDePrueba({ id: CAPEX, nombre: "Cuota inicial", naturaleza: "capex" }),
    categoriaDePrueba({ id: INGRESO, nombre: "Canon", naturaleza: "ingreso" }),
  ]);

  const movimientos = new MovimientoRepositoryEnMemoria();
  const obligaciones = new ObligacionRepositoryEnMemoria();
  obligaciones.hoy = HOY;
  const dashboard = new DashboardRepositoryEnMemoria();
  const reloj = new RelojFijo(HOY);
  let contador = 0;
  const nuevoId = () => `dddddddd-dddd-4ddd-8ddd-dddddddddd${String(++contador).padStart(2, "0")}`;

  const listar = new ListarMovimientos(movimientos, reloj);
  const generador = new GeneradorFalso();

  return {
    proyecto,
    proyectos,
    obligaciones,
    dashboard,
    generador,
    registrar: new RegistrarMovimiento(movimientos, proyectos, categorias, reloj, nuevoId),
    metodosPago: new MetodoPagoRepositoryEnMemoria([metodoTransferencia()]),
    reporteMovimientos: new ReporteMovimientos(listar, reloj),
    reporteFlujo: new ReporteFlujoCaja(dashboard, reloj),
    reporteObligaciones: new ReporteObligaciones(obligaciones, reloj),
    reporteEstado: new ReporteEstadoFinanciero(proyectos, reloj),
    exportar: new ExportarReporte(generador, generador, reloj),
  };
}

describe("ReporteMovimientos (RF-90)", () => {
  it("separa ingreso y egreso en columnas distintas y trae los totales del filtro", async () => {
    const { reporteMovimientos, registrar, proyecto } = montar();
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: CAPEX,
      tipo: "egreso",
      fecha: "2026-02-01",
      valor: 10_000_000,
      descripcion: "Cuota inicial",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });
    await registrar.ejecutar({
      proyectoId: proyecto.id,
      categoriaId: INGRESO,
      tipo: "ingreso",
      fecha: "2026-03-01",
      valor: 2_000_000,
      descripcion: "Canon marzo",
      metodoPagoId: ID_TRANSFERENCIA,
      estado: "pagado",
    });

    const reporte = await reporteMovimientos.ejecutar({});

    expect(reporte.tipo).toBe("movimientos");
    expect(reporte.filas).toHaveLength(2);
    const canon = reporte.filas.find((f) => f.descripcion === "Canon marzo");
    expect(canon?.ingreso).toBe(2_000_000);
    expect(canon?.egreso).toBeNull();
    expect(reporte.totales.find((t) => t.etiqueta === "Ingresos")?.valor).toBe("2000000");
    expect(reporte.generadoEn).toContain("2026-07-30");

    // §11: cada total declara si es dinero o un conteo. Sin esto, los tres
    // consumidores lo adivinaban por el tamaño del numero y el PDF imprimia
    // «$ 1.200» donde habia 1.200 movimientos contados.
    expect(reporte.totales.find((t) => t.etiqueta === "Ingresos")?.tipo).toBe("dinero");
    expect(reporte.totales.find((t) => t.etiqueta === "Movimientos")?.tipo).toBe("numero");
  });

  it("deja constancia de los filtros aplicados (RF-94, RF-95)", async () => {
    const { reporteMovimientos } = montar();

    const reporte = await reporteMovimientos.ejecutar({
      filtro: {
        proyectoNombre: "Apartamento Chapinero",
        desde: "2026-01-01",
        hasta: "2026-06-30",
        estados: ["pagado"],
      },
    });

    expect(reporte.filtros).toEqual([
      { etiqueta: "Proyecto", valor: "Apartamento Chapinero" },
      { etiqueta: "Rango", valor: "2026-01-01 a 2026-06-30" },
      { etiqueta: "Estado", valor: "Pagado" },
    ]);
  });
});

describe("ReporteFlujoCaja (RF-92)", () => {
  it("agrega el acumulado mes a mes", async () => {
    const { reporteFlujo, dashboard } = montar();
    dashboard.flujo = [
      { mes: "2026-01-01", ingresos: 100, egresos: 40, flujoNeto: 60 },
      { mes: "2026-02-01", ingresos: 10, egresos: 90, flujoNeto: -80 },
    ];

    const reporte = await reporteFlujo.ejecutar({});

    expect(reporte.filas.map((f) => f.acumulado)).toEqual([60, -20]);
  });
});

describe("ReporteObligaciones (RF-93)", () => {
  it("cuenta pendientes y vencidas por obligacion", async () => {
    const { reporteObligaciones, obligaciones, proyecto } = montar();
    await obligaciones.guardar(
      Obligacion.crear({
        id: "0b000000-0000-4000-8000-000000000001",
        proyectoId: proyecto.id,
        categoriaId: CAPEX,
        concepto: "Impuesto predial",
        valorEstimado: 900_000,
        fechaVencimiento: "2026-06-01",
        frecuencia: "mensual",
      }),
    );
    await obligaciones.generarOcurrencias(3);
    await obligaciones.marcarVencidos();

    const reporte = await reporteObligaciones.ejecutar({});

    expect(reporte.filas).toHaveLength(1);
    expect(reporte.filas[0]?.vencidas).toBe(2);
    expect(reporte.totales.find((t) => t.etiqueta === "Obligaciones")?.valor).toBe("1");
    // Un conteo de obligaciones no es un importe (§11).
    expect(reporte.totales.every((t) => t.tipo === "numero")).toBe(true);
  });
});

describe("ReporteEstadoFinanciero (RF-91)", () => {
  it("una fila por proyecto, con sus cifras", async () => {
    const { reporteEstado } = montar();

    const reporte = await reporteEstado.ejecutar({});

    expect(reporte.filas).toHaveLength(1);
    expect(reporte.filas[0]?.proyecto).toBe("Apartamento Chapinero");
  });
});

describe("ExportarReporte (RF-94, RF-95)", () => {
  it("nombra el archivo y elige el MIME segun el formato", async () => {
    const { exportar, reporteEstado } = montar();
    const reporte = await reporteEstado.ejecutar({});

    const excel = await exportar.ejecutar({
      reporte,
      formato: "excel",
      proyectoNombre: "Apartamento Chapinero",
    });
    const pdf = await exportar.ejecutar({ reporte, formato: "pdf" });

    expect(excel.nombre).toBe("estado_apartamento-chapinero_20260730.xlsx");
    expect(excel.mimeType).toContain("spreadsheetml");
    expect(pdf.nombre).toBe("estado_20260730.pdf");
    expect(pdf.mimeType).toBe("application/pdf");
  });

  it("se niega a exportar mas filas de las admitidas (§11)", async () => {
    const { exportar } = montar();
    const reporte: Reporte = {
      tipo: "movimientos",
      titulo: "Grande",
      generadoEn: "2026-07-30T12:00:00.000Z",
      filtros: [],
      columnas: [{ clave: "fecha", etiqueta: "Fecha", tipo: "fecha" }],
      filas: Array.from({ length: MAXIMO_FILAS_EXPORTACION + 1 }, () => ({ fecha: "2026-07-01" })),
      totales: [],
      moneda: "COP",
    };

    await expect(exportar.ejecutar({ reporte, formato: "excel" })).rejects.toMatchObject({
      codigo: "EXPORTACION_DEMASIADO_GRANDE",
    });
  });

  it("el exportador recibe el reporte intacto: no reformatea cifras", async () => {
    const { exportar, reporteFlujo, dashboard, generador } = montar();
    dashboard.flujo = [{ mes: "2026-01-01", ingresos: 100, egresos: 40, flujoNeto: 60 }];
    const reporte = await reporteFlujo.ejecutar({});

    await exportar.ejecutar({ reporte, formato: "excel" });

    expect(generador.recibidos[0]?.filas[0]?.ingresos).toBe(100);
  });
});
