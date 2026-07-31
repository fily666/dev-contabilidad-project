import type { Naturaleza } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { FlujoMensual } from "@/modules/proyectos/domain/indicadores";

/**
 * PUERTO de lectura agregada del dashboard y los reportes (Contexto.md §7.3).
 *
 * Todos sus metodos se sirven de las vistas de §6.4: la formula de cada cifra
 * esta definida una sola vez en SQL (ADR-11) y aqui solo se filtra y se suma lo
 * que la vista ya calculo.
 */

export type FiltroPanel = {
  proyectoId?: string;
  desde?: FechaIso;
  hasta?: FechaIso;
};

/** RF-70: tarjetas globales. */
export type TotalesGlobales = {
  totalInvertido: number;
  totalGastosOperativos: number;
  totalFinanciacion: number;
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  moneda: string;
};

/** RF-76: distribucion de gastos por categoria raiz. */
export type GastoPorCategoria = {
  categoriaId: string;
  categoria: string;
  naturaleza: Naturaleza;
  total: number;
  cantidad: number;
};

export interface DashboardRepository {
  /** Suma de `v_resumen_proyecto` sobre los proyectos del filtro. */
  totalesGlobales(filtro?: FiltroPanel): Promise<TotalesGlobales>;
  /** RF-71: serie mensual ejecutada, de `v_flujo_caja_mensual`. */
  flujoMensual(filtro?: FiltroPanel): Promise<FlujoMensual[]>;
  /** RF-72: serie proyectada, de `v_flujo_proyectado_mensual`. */
  flujoProyectado(filtro?: FiltroPanel): Promise<FlujoMensual[]>;
  /** RF-76: agregado por categoria raiz, de `v_gastos_por_categoria`. */
  gastosPorCategoria(filtro?: FiltroPanel): Promise<GastoPorCategoria[]>;
}
