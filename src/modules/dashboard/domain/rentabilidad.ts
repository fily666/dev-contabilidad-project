import { Dinero } from "@/shared/domain/dinero";
import type { EstadoProyecto } from "@/shared/domain/enumeraciones";

/**
 * RF-74, RF-77: rentabilidad comparable entre proyectos.
 *
 * Reutiliza la guarda de §5.3: sin inversion no hay ROI, y el indicador es
 * `null` en lugar de cero o infinito. Solo entran los proyectos con ingresos,
 * porque comparar la rentabilidad de un vehiculo con la de un apartamento
 * arrendado no significa nada (§5.4).
 */
export type FilaRentabilidad = {
  proyectoId: string;
  nombre: string;
  estado: EstadoProyecto;
  moneda: string;
  totalInvertido: number;
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  roi: number | null;
};

export type EntradaRentabilidad = {
  proyectoId: string;
  nombre: string;
  estado: EstadoProyecto;
  moneda: string;
  totalInvertido: number;
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
};

/**
 * ROI acumulado de un proyecto: resultado sobre lo invertido.
 *
 * El **cálculo** está separado del **filtro** a propósito. Antes vivían juntos, y
 * la consecuencia era que el ROI solo existía para los proyectos con ingresos: la
 * tabla de cartera no podía mostrar «—» en los demás porque no recibía el dato,
 * y §5.3 dice justamente que un indicador no calculable se presenta como «—».
 *
 * El filtro de §5.4 —comparar el ROI de un vehículo con el de un apartamento
 * arrendado no significa nada— sigue aplicándose donde corresponde: en el ranking
 * de RF-74, no en la medida.
 */
export function roiDeProyecto(p: EntradaRentabilidad): number | null {
  const resultado = Dinero.de(p.totalIngresos, p.moneda).menos(Dinero.de(p.totalEgresos, p.moneda));
  return resultado.dividido(Dinero.de(p.totalInvertido, p.moneda));
}

/** RF-74: el ranking comparable, que sí excluye los proyectos sin ingresos. */
export function rentabilidadPorProyecto(
  proyectos: readonly EntradaRentabilidad[],
): FilaRentabilidad[] {
  return proyectos
    .filter((p) => p.totalIngresos > 0)
    .map((p) => ({ ...p, roi: roiDeProyecto(p) }))
    .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity));
}

/**
 * RF-75: evolucion del gasto mes a mes con su acumulado, para que la grafica
 * muestre la tendencia y no solo la altura de cada barra.
 */
export function evolucionDeGastos(
  flujo: readonly { mes: string; egresos: number }[],
): Array<{ mes: string; egresos: number; acumulado: number }> {
  let acumulado = 0;
  return [...flujo]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((punto) => {
      acumulado += punto.egresos;
      return { mes: punto.mes, egresos: punto.egresos, acumulado };
    });
}
