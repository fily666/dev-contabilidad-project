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
  TotalesPorProyecto,
} from "../domain/dashboard.repository";
import {
  evolucionDeGastos,
  rentabilidadPorProyecto,
  roiDeProyecto,
  type FilaRentabilidad,
} from "../domain/rentabilidad";

/**
 * Variación de cada total frente al periodo inmediatamente anterior de igual
 * longitud.
 *
 * Es la respuesta a «¿qué cambió?», que el panel no daba en ningún sitio: mostraba
 * el estado actual y nada contra qué compararlo. Cada campo es un tanto por uno, y
 * `null` cuando el periodo anterior fue cero — la guarda de §5.3: sin base no hay
 * porcentaje, y `+100 %` sobre cero no significa nada.
 */
export type VariacionTotales = {
  totalInvertido: number | null;
  totalIngresos: number | null;
  totalEgresos: number | null;
  balance: number | null;
  /** El rango con el que se comparó, para poder decirlo en la interfaz. */
  periodoAnterior: { desde: string; hasta: string } | null;
};

export type Panel = {
  filtro: FiltroPanel;
  /** RF-70. */
  totales: TotalesGlobales;
  /** RF-70: cuánto se movió cada total frente al periodo anterior. */
  variacion: VariacionTotales;
  /** RF-71: ejecutado. */
  flujoMensual: FlujoMensual[];
  flujoAcumulado: Array<FlujoMensual & { acumulado: number }>;
  /** RF-72: proyectado. */
  flujoProyectado: FlujoMensual[];
  /** RF-75. */
  evolucionGastos: Array<{ mes: string; egresos: number; acumulado: number }>;
  /** RF-76. */
  gastosPorCategoria: GastoPorCategoria[];
  /** RF-74: el ranking comparable, solo proyectos con ingresos (§5.4). */
  rentabilidad: FilaRentabilidad[];
  /**
   * RF-77: el ROI de TODOS los proyectos del filtro, con `null` donde no es
   * calculable. Es lo que permite que la tabla de cartera muestre «—» en lugar de
   * omitir la fila, como manda §5.3.
   */
  roiPorProyecto: Map<string, number | null>;
  /** RF-77. */
  proyectos: ResumenProyecto[];
  /** RF-73. */
  proximosPagos: EventoAgenda[];
  obligacionesVencidas: EventoAgenda[];
  proyectosActivos: number;
};

/**
 * Reemplaza las cifras historicas de `ResumenProyecto` por las del rango.
 *
 * `proyectos.listar()` trae la identidad del proyecto (nombre, tipo, estado) y
 * sus cifras de toda la historia, porque `v_resumen_proyecto` no admite rango.
 * La identidad se conserva; las cifras se sustituyen por las del rango. Un
 * proyecto sin movimientos pagados en el rango no aparece en el desglose y sus
 * cifras quedan en cero, que es la respuesta correcta a «cuanto movio este
 * proyecto en el periodo consultado».
 *
 * `ultimoMovimiento` se deja como esta a proposito: es un dato de la historia
 * del proyecto, no del rango. Acotarlo diria «sin movimientos registrados» de un
 * proyecto que si los tiene fuera de la ventana.
 */
function conCifrasDelRango(
  proyectos: readonly ResumenProyecto[],
  porProyecto: readonly TotalesPorProyecto[],
): ResumenProyecto[] {
  const rango = new Map(porProyecto.map((t) => [t.proyectoId, t]));

  return proyectos.map((proyecto) => {
    const cifras = rango.get(proyecto.proyectoId);
    return {
      ...proyecto,
      totalInvertido: cifras?.totalInvertido ?? 0,
      totalIngresos: cifras?.totalIngresos ?? 0,
      totalEgresos: cifras?.totalEgresos ?? 0,
      balance: cifras?.balance ?? 0,
    };
  });
}

/**
 * El periodo inmediatamente anterior, de la misma longitud en meses.
 *
 * Se cuenta en MESES y no en días porque las vistas de §6.4 agregan por mes: un
 * desplazamiento en días dejaría el periodo anterior a medio mes y compararía
 * cosas de distinto tamaño. `null` si el filtro no trae rango completo, porque
 * entonces no hay nada con qué comparar.
 */
function periodoAnterior(filtro: FiltroPanel): { desde: string; hasta: string } | null {
  if (!filtro.desde || !filtro.hasta) return null;

  const mes = (iso: string) => {
    const [anio, m] = iso.split("-").map(Number) as [number, number];
    return anio * 12 + (m - 1);
  };

  const largo = mes(filtro.hasta) - mes(filtro.desde) + 1;
  if (largo <= 0) return null;

  const aIso = (indice: number, dia: number) =>
    new Date(Date.UTC(Math.floor(indice / 12), indice % 12, dia)).toISOString().slice(0, 10);

  const desdeIndice = mes(filtro.desde) - largo;
  // Día 0 del mes siguiente: el último del mes anterior al rango consultado.
  return { desde: aIso(desdeIndice, 1), hasta: aIso(mes(filtro.desde), 0) };
}

/** Tanto por uno de variación; `null` cuando la base es cero (§5.3). */
function variacion(actual: number, base: number): number | null {
  if (!Number.isFinite(base) || base === 0) return null;
  return (actual - base) / Math.abs(base);
}

function variacionEntre(
  actual: TotalesGlobales,
  anterior: TotalesGlobales | null,
  periodo: { desde: string; hasta: string } | null,
): VariacionTotales {
  if (!anterior || !periodo) {
    return {
      totalInvertido: null,
      totalIngresos: null,
      totalEgresos: null,
      balance: null,
      periodoAnterior: null,
    };
  }

  return {
    totalInvertido: variacion(actual.totalInvertido, anterior.totalInvertido),
    totalIngresos: variacion(actual.totalIngresos, anterior.totalIngresos),
    totalEgresos: variacion(actual.totalEgresos, anterior.totalEgresos),
    balance: variacion(actual.balance, anterior.balance),
    periodoAnterior: periodo,
  };
}

/**
 * RF-70 a RF-79: el panel completo en una sola llamada.
 *
 * Compone lecturas ya agregadas; no calcula ninguna cifra que no venga de una
 * vista o de una funcion del dominio (ADR-11). El rango de fechas de RF-79 se
 * aplica a las cifras ejecutadas, no a la agenda: lo que vence la semana que
 * viene sigue siendo urgente aunque el rango consultado sea el año pasado.
 *
 * **Todas las cifras del panel son del rango, incluidas las de cada proyecto.**
 * Antes las tarjetas de RF-77 y la tabla de RF-74 salian del resumen historico,
 * de modo que la pantalla mezclaba dos ventanas temporales bajo etiquetas
 * identicas. Ese era el defecto: no que una de las dos estuviera mal calculada,
 * sino que las dos se presentaban como la misma cosa.
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

    const anterior = periodoAnterior(filtro);

    const [totales, flujo, porProyecto, proyectado, gastos, proyectos, agenda, totalesAnteriores] =
      await Promise.all([
        this.dashboard.totalesGlobales(filtro),
        this.dashboard.flujoMensual(filtro),
        this.dashboard.totalesPorProyecto(filtro),
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
        anterior
          ? this.dashboard.totalesGlobales({ proyectoId: filtro.proyectoId, ...anterior })
          : Promise.resolve(null),
      ]);

    const delFiltro = filtro.proyectoId
      ? proyectos.filter((p) => p.proyectoId === filtro.proyectoId)
      : proyectos;

    const delRango = conCifrasDelRango(delFiltro, porProyecto);

    // Una sola proyeccion para las dos lecturas de rentabilidad: el ranking de
    // RF-74 y el ROI por proyecto de RF-77.
    const entradas = delRango.map((p) => ({
      proyectoId: p.proyectoId,
      nombre: p.nombre,
      estado: p.estado,
      moneda: p.moneda,
      totalInvertido: p.totalInvertido,
      totalIngresos: p.totalIngresos,
      totalEgresos: p.totalEgresos,
      balance: p.balance,
    }));

    return {
      filtro,
      totales,
      variacion: variacionEntre(totales, totalesAnteriores, anterior),
      flujoMensual: flujo,
      flujoAcumulado: flujoAcumulado(flujo),
      flujoProyectado: proyectado,
      evolucionGastos: evolucionDeGastos(flujo),
      gastosPorCategoria: gastos,
      rentabilidad: rentabilidadPorProyecto(entradas),
      roiPorProyecto: new Map(entradas.map((p) => [p.proyectoId, roiDeProyecto(p)])),
      proyectos: delRango,
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
