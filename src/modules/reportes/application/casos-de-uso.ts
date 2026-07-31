import type { Reloj } from "@/shared/domain/reloj";
import { ETIQUETA_ESTADO_MOVIMIENTO, ETIQUETA_NATURALEZA } from "@/shared/utils/etiquetas";
import type { ListarMovimientos } from "@/modules/movimientos/application/listar-movimientos.use-case";
import type { FiltroMovimientos } from "@/modules/movimientos/domain/movimiento.repository";
import type { ObligacionRepository } from "@/modules/obligaciones/domain/obligacion.repository";
import type { ProyectoRepository } from "@/modules/proyectos/domain/proyecto.repository";
import type { DashboardRepository } from "@/modules/dashboard/domain/dashboard.repository";

import type { GeneradorExcel, GeneradorPdf } from "../domain/exportadores";
import {
  exigirTamanoExportable,
  MAXIMO_FILAS_EXPORTACION,
  nombreDeArchivo,
  type Reporte,
  type TipoReporte,
} from "../domain/reporte";

/**
 * Casos de uso de reportes (Contexto.md RF-90 a RF-95, §11).
 *
 * Se construyen sobre los mismos casos de uso y vistas que alimentan el
 * dashboard: una sola definicion de cada cifra (ADR-11). Aqui solo se aplana a
 * filas y se les pone etiqueta en español (RNF-13).
 */

export type FiltroReporte = {
  proyectoId?: string;
  proyectoNombre?: string | null;
  desde?: string;
  hasta?: string;
  tipos?: FiltroMovimientos["tipos"];
  estados?: FiltroMovimientos["estados"];
  categoriaIds?: string[];
};

function filtrosLegibles(filtro: FiltroReporte): Array<{ etiqueta: string; valor: string }> {
  const filtros: Array<{ etiqueta: string; valor: string }> = [];
  filtros.push({ etiqueta: "Proyecto", valor: filtro.proyectoNombre ?? "Todos" });
  filtros.push({
    etiqueta: "Rango",
    valor:
      filtro.desde || filtro.hasta
        ? `${filtro.desde ?? "inicio"} a ${filtro.hasta ?? "hoy"}`
        : "Sin límite",
  });
  if (filtro.tipos?.length) {
    filtros.push({ etiqueta: "Tipo", valor: filtro.tipos.join(", ") });
  }
  if (filtro.estados?.length) {
    filtros.push({
      etiqueta: "Estado",
      valor: filtro.estados.map((e) => ETIQUETA_ESTADO_MOVIMIENTO[e]).join(", "),
    });
  }
  return filtros;
}

/** RF-90. */
export class ReporteMovimientos {
  constructor(
    private readonly movimientos: ListarMovimientos,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { filtro?: FiltroReporte } = {}): Promise<Reporte> {
    const filtro = entrada.filtro ?? {};
    const pagina = await this.movimientos.ejecutar({
      filtro: {
        proyectoId: filtro.proyectoId,
        desde: filtro.desde,
        hasta: filtro.hasta,
        tipos: filtro.tipos,
        estados: filtro.estados,
        categoriaIds: filtro.categoriaIds,
      },
      orden: { campo: "fecha", direccion: "desc" },
      paginacion: { pagina: 1, porPagina: MAXIMO_FILAS_EXPORTACION },
    });

    return {
      tipo: "movimientos",
      titulo: "Reporte de movimientos",
      generadoEn: this.reloj.ahora().toISOString(),
      filtros: filtrosLegibles(filtro),
      moneda: pagina.filas[0]?.moneda ?? "COP",
      columnas: [
        { clave: "fecha", etiqueta: "Fecha", tipo: "fecha", ancho: 12 },
        { clave: "proyecto", etiqueta: "Proyecto", tipo: "texto", ancho: 24 },
        { clave: "descripcion", etiqueta: "Descripción", tipo: "texto", ancho: 34 },
        { clave: "categoria", etiqueta: "Categoría", tipo: "texto", ancho: 26 },
        { clave: "naturaleza", etiqueta: "Naturaleza", tipo: "texto", ancho: 16 },
        { clave: "metodoPago", etiqueta: "Método de pago", tipo: "texto", ancho: 18 },
        { clave: "estado", etiqueta: "Estado", tipo: "texto", ancho: 12 },
        { clave: "ingreso", etiqueta: "Ingreso", tipo: "dinero", ancho: 16 },
        { clave: "egreso", etiqueta: "Egreso", tipo: "dinero", ancho: 16 },
      ],
      filas: pagina.filas.map((fila) => ({
        fecha: fila.fecha,
        proyecto: fila.proyectoNombre,
        descripcion: fila.descripcion,
        categoria: fila.categoriaRuta,
        naturaleza: ETIQUETA_NATURALEZA[fila.naturaleza],
        metodoPago: fila.metodoPago,
        estado: ETIQUETA_ESTADO_MOVIMIENTO[fila.estadoEfectivo],
        ingreso: fila.tipo === "ingreso" ? fila.valor : null,
        egreso: fila.tipo === "egreso" ? fila.valor : null,
      })),
      totales: [
        { etiqueta: "Movimientos", valor: String(pagina.total) },
        { etiqueta: "Ingresos", valor: String(pagina.totales.ingresos) },
        { etiqueta: "Egresos", valor: String(pagina.totales.egresos) },
        { etiqueta: "Del cual inversión", valor: String(pagina.totales.invertido) },
      ],
    };
  }
}

/** RF-92. */
export class ReporteFlujoCaja {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { filtro?: FiltroReporte } = {}): Promise<Reporte> {
    const filtro = entrada.filtro ?? {};
    const [flujo, totales] = await Promise.all([
      this.dashboard.flujoMensual(filtro),
      this.dashboard.totalesGlobales(filtro),
    ]);

    let acumulado = 0;
    const filas = flujo.map((punto) => {
      acumulado += punto.flujoNeto;
      return {
        mes: punto.mes,
        ingresos: punto.ingresos,
        egresos: punto.egresos,
        flujoNeto: punto.flujoNeto,
        acumulado,
      };
    });

    return {
      tipo: "flujo",
      titulo: "Reporte de flujo de caja mensual",
      generadoEn: this.reloj.ahora().toISOString(),
      filtros: filtrosLegibles(filtro),
      moneda: totales.moneda,
      columnas: [
        { clave: "mes", etiqueta: "Mes", tipo: "fecha", ancho: 12 },
        { clave: "ingresos", etiqueta: "Ingresos", tipo: "dinero", ancho: 18 },
        { clave: "egresos", etiqueta: "Egresos", tipo: "dinero", ancho: 18 },
        { clave: "flujoNeto", etiqueta: "Flujo neto", tipo: "dinero", ancho: 18 },
        { clave: "acumulado", etiqueta: "Acumulado", tipo: "dinero", ancho: 18 },
      ],
      filas,
      totales: [
        { etiqueta: "Ingresos", valor: String(totales.totalIngresos) },
        { etiqueta: "Egresos", valor: String(totales.totalEgresos) },
        { etiqueta: "Balance", valor: String(totales.balance) },
      ],
    };
  }
}

/** RF-93. */
export class ReporteObligaciones {
  constructor(
    private readonly obligaciones: ObligacionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { filtro?: FiltroReporte } = {}): Promise<Reporte> {
    const filtro = entrada.filtro ?? {};
    const listado = await this.obligaciones.listar({ proyectoId: filtro.proyectoId });

    const pendientes = listado.reduce((s, o) => s + o.ocurrenciasPendientes, 0);
    const vencidas = listado.reduce((s, o) => s + o.ocurrenciasVencidas, 0);

    return {
      tipo: "obligaciones",
      titulo: "Reporte de obligaciones",
      generadoEn: this.reloj.ahora().toISOString(),
      filtros: filtrosLegibles(filtro),
      moneda: listado[0]?.moneda ?? "COP",
      columnas: [
        { clave: "concepto", etiqueta: "Concepto", tipo: "texto", ancho: 30 },
        { clave: "proyecto", etiqueta: "Proyecto", tipo: "texto", ancho: 24 },
        { clave: "categoria", etiqueta: "Categoría", tipo: "texto", ancho: 22 },
        { clave: "frecuencia", etiqueta: "Frecuencia", tipo: "texto", ancho: 14 },
        { clave: "proximo", etiqueta: "Próximo vencimiento", tipo: "fecha", ancho: 20 },
        { clave: "valorEstimado", etiqueta: "Valor estimado", tipo: "dinero", ancho: 18 },
        { clave: "pendientes", etiqueta: "Pendientes", tipo: "numero", ancho: 12 },
        { clave: "vencidas", etiqueta: "Vencidas", tipo: "numero", ancho: 12 },
        { clave: "estado", etiqueta: "Estado", tipo: "texto", ancho: 14 },
      ],
      filas: listado.map((o) => ({
        concepto: o.concepto,
        proyecto: o.proyectoNombre,
        categoria: o.categoria,
        frecuencia: o.frecuencia,
        proximo: o.proximoVencimiento,
        valorEstimado: o.valorEstimado,
        pendientes: o.ocurrenciasPendientes,
        vencidas: o.ocurrenciasVencidas,
        estado: o.activa ? "Activa" : "Suspendida",
      })),
      totales: [
        { etiqueta: "Obligaciones", valor: String(listado.length) },
        { etiqueta: "Ocurrencias pendientes", valor: String(pendientes) },
        { etiqueta: "Ocurrencias vencidas", valor: String(vencidas) },
      ],
    };
  }
}

/** RF-91: estado financiero por proyecto. */
export class ReporteEstadoFinanciero {
  constructor(
    private readonly proyectos: ProyectoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { filtro?: FiltroReporte } = {}): Promise<Reporte> {
    const filtro = entrada.filtro ?? {};
    const listado = await this.proyectos.listar({
      estados: ["activo", "pausado", "finalizado", "archivado"],
    });
    const filtrados = filtro.proyectoId
      ? listado.filter((p) => p.proyectoId === filtro.proyectoId)
      : listado;

    return {
      tipo: "estado",
      titulo: "Reporte de estado financiero por proyecto",
      generadoEn: this.reloj.ahora().toISOString(),
      filtros: filtrosLegibles(filtro),
      moneda: filtrados[0]?.moneda ?? "COP",
      columnas: [
        { clave: "proyecto", etiqueta: "Proyecto", tipo: "texto", ancho: 28 },
        { clave: "tipo", etiqueta: "Tipo", tipo: "texto", ancho: 16 },
        { clave: "estado", etiqueta: "Estado", tipo: "texto", ancho: 14 },
        { clave: "invertido", etiqueta: "Invertido", tipo: "dinero", ancho: 18 },
        { clave: "ingresos", etiqueta: "Ingresos", tipo: "dinero", ancho: 18 },
        { clave: "egresos", etiqueta: "Egresos", tipo: "dinero", ancho: 18 },
        { clave: "balance", etiqueta: "Balance", tipo: "dinero", ancho: 18 },
      ],
      filas: filtrados.map((p) => ({
        proyecto: p.nombre,
        tipo: p.tipoNombre,
        estado: p.estado,
        invertido: p.totalInvertido,
        ingresos: p.totalIngresos,
        egresos: p.totalEgresos,
        balance: p.balance,
      })),
      totales: [
        { etiqueta: "Proyectos", valor: String(filtrados.length) },
        {
          etiqueta: "Invertido",
          valor: String(filtrados.reduce((s, p) => s + p.totalInvertido, 0)),
        },
        { etiqueta: "Balance", valor: String(filtrados.reduce((s, p) => s + p.balance, 0)) },
      ],
    };
  }
}

/** RF-94, RF-95: exportacion conservando los filtros aplicados. */
export class ExportarReporte {
  constructor(
    private readonly excel: GeneradorExcel,
    private readonly pdf: GeneradorPdf,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: {
    reporte: Reporte;
    formato: "excel" | "pdf";
    proyectoNombre?: string | null;
  }): Promise<{ bytes: Uint8Array; nombre: string; mimeType: string }> {
    exigirTamanoExportable(entrada.reporte);

    const esExcel = entrada.formato === "excel";
    const bytes = esExcel
      ? await this.excel.generar(entrada.reporte)
      : await this.pdf.generar(entrada.reporte);

    return {
      bytes,
      nombre: nombreDeArchivo({
        tipo: entrada.reporte.tipo,
        proyecto: entrada.proyectoNombre,
        hoy: this.reloj.hoy(),
        extension: esExcel ? "xlsx" : "pdf",
      }),
      mimeType: esExcel
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf",
    };
  }
}

/** Fabrica de reportes por tipo, para que la ruta de exportacion sea una sola. */
export type ArmadoresDeReporte = Record<
  TipoReporte,
  { ejecutar(entrada: { filtro?: FiltroReporte }): Promise<Reporte> }
>;
