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

export function rentabilidadPorProyecto(
  proyectos: readonly EntradaRentabilidad[],
): FilaRentabilidad[] {
  return proyectos
    .filter((p) => p.totalIngresos > 0)
    .map((p) => {
      const resultado = Dinero.de(p.totalIngresos, p.moneda).menos(
        Dinero.de(p.totalEgresos, p.moneda),
      );
      return { ...p, roi: resultado.dividido(Dinero.de(p.totalInvertido, p.moneda)) };
    })
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
