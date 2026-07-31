import type { Reloj } from "@/shared/domain/reloj";
import { flujoAcumulado, type FlujoMensual } from "@/modules/proyectos/domain/indicadores";
import type {
  ProyectoRepository,
  ResumenProyecto,
} from "@/modules/proyectos/domain/proyecto.repository";
import type {
  EventoAgenda,
  ObligacionRepository,
} from "@/modules/obligaciones/domain/obligacion.repository";

import type {
  DashboardRepository,
  FiltroPanel,
  GastoPorCategoria,
  TotalesGlobales,
} from "../domain/dashboard.repository";
import {
  evolucionDeGastos,
  rentabilidadPorProyecto,
  type FilaRentabilidad,
} from "../domain/rentabilidad";

export type Panel = {
  filtro: FiltroPanel;
  /** RF-70. */
  totales: TotalesGlobales;
  /** RF-71: ejecutado. */
  flujoMensual: FlujoMensual[];
  flujoAcumulado: Array<FlujoMensual & { acumulado: number }>;
  /** RF-72: proyectado. */
  flujoProyectado: FlujoMensual[];
  /** RF-75. */
  evolucionGastos: Array<{ mes: string; egresos: number; acumulado: number }>;
  /** RF-76. */
  gastosPorCategoria: GastoPorCategoria[];
  /** RF-74. */
  rentabilidad: FilaRentabilidad[];
  /** RF-77. */
  proyectos: ResumenProyecto[];
  /** RF-73. */
  proximosPagos: EventoAgenda[];
  obligacionesVencidas: EventoAgenda[];
  proyectosActivos: number;
};

/**
 * RF-70 a RF-79: el panel completo en una sola llamada.
 *
 * Compone lecturas ya agregadas; no calcula ninguna cifra que no venga de una
 * vista o de una funcion del dominio (ADR-11). El rango de fechas de RF-79 se
 * aplica a las cifras ejecutadas, no a la agenda: lo que vence la semana que
 * viene sigue siendo urgente aunque el rango consultado sea el año pasado.
 */
export class ObtenerPanel {
  constructor(
    private readonly dashboard: DashboardRepository,
    private readonly proyectos: ProyectoRepository,
    private readonly obligaciones: ObligacionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { filtro?: FiltroPanel } = {}): Promise<Panel> {
    const filtro = entrada.filtro ?? {};

    const [totales, flujo, proyectado, gastos, proyectos, agenda] = await Promise.all([
      this.dashboard.totalesGlobales(filtro),
      this.dashboard.flujoMensual(filtro),
      this.dashboard.flujoProyectado({ proyectoId: filtro.proyectoId }),
      this.dashboard.gastosPorCategoria(filtro),
      this.proyectos.listar({
        estados: ["activo", "pausado", "finalizado"],
        tipoProyectoId: undefined,
      }),
      this.obligaciones.listarAgenda({
        proyectoId: filtro.proyectoId,
        dentroDeDias: 30,
        incluirVencidas: true,
      }),
    ]);

    const delFiltro = filtro.proyectoId
      ? proyectos.filter((p) => p.proyectoId === filtro.proyectoId)
      : proyectos;

    return {
      filtro,
      totales,
      flujoMensual: flujo,
      flujoAcumulado: flujoAcumulado(flujo),
      flujoProyectado: proyectado,
      evolucionGastos: evolucionDeGastos(flujo),
      gastosPorCategoria: gastos,
      rentabilidad: rentabilidadPorProyecto(
        delFiltro.map((p) => ({
          proyectoId: p.proyectoId,
          nombre: p.nombre,
          estado: p.estado,
          moneda: p.moneda,
          totalInvertido: p.totalInvertido,
          totalIngresos: p.totalIngresos,
          totalEgresos: p.totalEgresos,
          balance: p.balance,
        })),
      ),
      proyectos: delFiltro,
      proximosPagos: agenda.filter((e) => e.diasRestantes >= 0),
      obligacionesVencidas: agenda.filter((e) => e.diasRestantes < 0),
      proyectosActivos: delFiltro.filter((p) => p.estado === "activo").length,
    };
  }

  /** Rango por omision del panel: los ultimos doce meses cerrados (RF-71). */
  rangoPorOmision(): { desde: string; hasta: string } {
    const hoy = this.reloj.hoy();
    const [anio, mes] = hoy.split("-").map(Number) as [number, number];
    const inicio = new Date(Date.UTC(anio, mes - 1 - 11, 1));
    return { desde: inicio.toISOString().slice(0, 10), hasta: hoy };
  }
}
