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

/**
 * RF-74, RF-77: los agregados de §5.1 por proyecto, **acotados al rango** de
 * RF-79.
 *
 * Existe porque `v_resumen_proyecto` agrega sobre toda la historia y no admite
 * rango. Mientras el panel leyó de ahí las tarjetas de proyecto y la tabla de
 * rentabilidad, la pantalla mezclaba dos ventanas temporales bajo las mismas
 * etiquetas: «Total invertido» arriba era del rango y «Invertido» en la tarjeta
 * era de siempre. Dos cifras con el mismo nombre y distinto significado a 600 px
 * de distancia.
 *
 * El resumen histórico sigue siendo el correcto donde no hay rango que aplicar
 * (el listado de `/proyectos`), así que ninguna de las dos lecturas sustituye a
 * la otra: son dos preguntas distintas y ahora cada una tiene su método.
 */
export type TotalesPorProyecto = {
  proyectoId: string;
  totalInvertido: number;
  totalGastosOperativos: number;
  totalFinanciacion: number;
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
};

/**
 * §5.5: flujo neto por proyecto de una ventana reciente, para el semáforo.
 *
 * No se puede derivar del rango de RF-79 porque no es la misma pregunta: el
 * semáforo mira los últimos tres meses **de hoy**, aunque el panel esté
 * consultando el año pasado. Un proyecto no está en riesgo por lo que pasó en un
 * rango que el usuario eligió mirar.
 */
export type FlujoRecientePorProyecto = {
  proyectoId: string;
  flujoNeto: number;
};

export interface DashboardRepository {
  /** RF-70: totales del rango, sumados de `v_movimientos_mensual`. */
  totalesGlobales(filtro?: FiltroPanel): Promise<TotalesGlobales>;
  /** §5.5: flujo neto por proyecto desde `desdeMes` (primer día de mes). */
  flujoRecientePorProyecto(desdeMes: FechaIso): Promise<FlujoRecientePorProyecto[]>;
  /** RF-71: serie mensual ejecutada, de `v_movimientos_mensual`. */
  flujoMensual(filtro?: FiltroPanel): Promise<FlujoMensual[]>;
  /** RF-74, RF-77: los mismos totales desglosados por proyecto. */
  totalesPorProyecto(filtro?: FiltroPanel): Promise<TotalesPorProyecto[]>;
  /** RF-72: serie proyectada, de `v_flujo_proyectado_mensual`. */
  flujoProyectado(filtro?: FiltroPanel): Promise<FlujoMensual[]>;
  /** RF-76: agregado por categoria raiz, de `v_gastos_mensual_categoria`. */
  gastosPorCategoria(filtro?: FiltroPanel): Promise<GastoPorCategoria[]>;
}
