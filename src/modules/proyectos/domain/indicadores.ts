import { Dinero } from "@/shared/domain/dinero";
import { mesesEntre, type FechaIso } from "@/shared/domain/reloj";

/**
 * Fórmulas normativas de Contexto.md §5. Implementadas UNA sola vez y
 * consumidas por el resumen de proyecto, el dashboard y los reportes.
 *
 * Guarda de §5.3: cuando el divisor es cero, el indicador es `null` y la
 * interfaz muestra «—». Nunca 0 %, NaN ni infinito.
 */

export type FlujoMensual = {
  mes: FechaIso;
  ingresos: number;
  egresos: number;
  flujoNeto: number;
};

/** Insumos ya agregados (provienen de las vistas de §6.4). */
export type CifrasProyecto = {
  moneda: string;
  fechaInicio: FechaIso;
  hoy: FechaIso;
  /** Egresos capex pagados. */
  totalInvertido: number;
  /** Egresos opex pagados. */
  totalGastosOperativos: number;
  /** Cuotas de credito pagadas. */
  totalFinanciacion: number;
  totalIngresos: number;
  abonosACapital: number;
  ingresos12m: number;
  gastosOperativos12m: number;
  valoracionActual: number | null;
  pasivoTotal: number;
  flujoMensual: FlujoMensual[];
};

export type Indicadores = {
  moneda: string;
  totalInvertido: number;
  totalGastosOperativos: number;
  totalFinanciacion: number;
  totalEgresos: number;
  totalIngresos: number;
  balance: number;
  /** Dinero propio efectivamente puesto: capex + abonos a capital (§5.1). */
  capitalAportado: number;
  /** Resultado operativo neto de los ultimos 12 meses (§5.3). */
  noiAnual: number;
  roiAcumulado: number | null;
  yieldBruto: number | null;
  yieldNeto: number | null;
  capRate: number | null;
  plusvalia: number | null;
  retornoTotal: number | null;
  paybackMeses: number | null;
  /** Costo total de propiedad, para proyectos sin ingresos (§5.3). */
  tco: number;
  costoMensual: number | null;
  patrimonioNeto: number | null;
  mesesDeHistoria: number;
  /** true si el proyecto tiene menos de 12 meses: los anualizados son estimados (§5.3). */
  esEstimado: boolean;
};

export function calcularIndicadores(cifras: CifrasProyecto): Indicadores {
  const m = cifras.moneda;
  const invertido = Dinero.de(cifras.totalInvertido, m);
  const gastosOp = Dinero.de(cifras.totalGastosOperativos, m);
  const financiacion = Dinero.de(cifras.totalFinanciacion, m);
  const ingresos = Dinero.de(cifras.totalIngresos, m);
  const abonos = Dinero.de(cifras.abonosACapital, m);

  const egresos = invertido.mas(gastosOp).mas(financiacion);
  const balance = ingresos.menos(egresos);
  const capitalAportado = invertido.mas(abonos);

  const ingresos12m = Dinero.de(cifras.ingresos12m, m);
  const gastosOp12m = Dinero.de(cifras.gastosOperativos12m, m);
  const noi = ingresos12m.menos(gastosOp12m);

  const mesesDeHistoria = Math.max(0, mesesEntre(cifras.fechaInicio, cifras.hoy));
  const esEstimado = mesesDeHistoria < 12;

  const resultadoAcumulado = ingresos.menos(gastosOp).menos(financiacion);
  const roiAcumulado = resultadoAcumulado.dividido(invertido);
  const yieldBruto = ingresos12m.dividido(invertido);
  const yieldNeto = noi.dividido(invertido);

  const valoracion =
    cifras.valoracionActual === null ? null : Dinero.de(cifras.valoracionActual, m);
  const capRate = valoracion === null ? null : noi.dividido(valoracion);
  const plusvalia = valoracion === null ? null : valoracion.menos(invertido).valor;
  const retornoTotal =
    plusvalia === null ? null : resultadoAcumulado.mas(Dinero.de(plusvalia, m)).dividido(invertido);

  const pasivo = Dinero.de(cifras.pasivoTotal, m);
  const patrimonioNeto = valoracion === null ? null : valoracion.menos(pasivo).valor;

  return {
    moneda: m,
    totalInvertido: invertido.valor,
    totalGastosOperativos: gastosOp.valor,
    totalFinanciacion: financiacion.valor,
    totalEgresos: egresos.valor,
    totalIngresos: ingresos.valor,
    balance: balance.valor,
    capitalAportado: capitalAportado.valor,
    noiAnual: noi.valor,
    roiAcumulado,
    yieldBruto,
    yieldNeto,
    capRate,
    plusvalia,
    retornoTotal,
    paybackMeses: calcularPayback(cifras.flujoMensual),
    tco: egresos.valor,
    costoMensual: mesesDeHistoria > 0 ? egresos.por(1 / mesesDeHistoria).valor : null,
    patrimonioNeto,
    mesesDeHistoria,
    esEstimado,
  };
}

/**
 * §5.3: primer mes en el que el flujo acumulado deja de ser negativo, contado
 * desde el primer mes con movimientos. `null` si aun no se ha recuperado.
 */
export function calcularPayback(flujo: readonly FlujoMensual[]): number | null {
  if (flujo.length === 0) return null;
  const ordenado = [...flujo].sort((a, b) => a.mes.localeCompare(b.mes));

  let acumulado = 0;
  for (const [indice, mes] of ordenado.entries()) {
    acumulado += mes.flujoNeto;
    if (acumulado >= 0) return indice + 1;
  }
  return null;
}

/** Serie de flujo acumulado, para graficar la evolucion (RF-71). */
export function flujoAcumulado(
  flujo: readonly FlujoMensual[],
): Array<FlujoMensual & { acumulado: number }> {
  let acumulado = 0;
  return [...flujo]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((mes) => {
      acumulado += mes.flujoNeto;
      return { ...mes, acumulado };
    });
}

export const ESTADOS_FINANCIEROS = ["saludable", "observacion", "riesgo"] as const;
export type EstadoFinanciero = (typeof ESTADOS_FINANCIEROS)[number];

export type SenalesEstadoFinanciero = {
  obligacionesVencidas: number;
  obligacionesPorVencer7Dias: number;
  /** Flujo neto de los ultimos tres meses cerrados. */
  flujoUltimos3Meses: number;
  generaIngresos: boolean;
  presupuestoExcedido: boolean;
  /** Porcentaje de ejecucion del presupuesto vigente (0-1), si existe. */
  ejecucionPresupuesto: number | null;
};

/** §5.5 Semaforo del estado financiero del proyecto. */
export function calcularEstadoFinanciero(senales: SenalesEstadoFinanciero): {
  estado: EstadoFinanciero;
  motivo: string;
} {
  if (senales.obligacionesVencidas > 0) {
    return {
      estado: "riesgo",
      motivo:
        senales.obligacionesVencidas === 1
          ? "Hay 1 obligación vencida."
          : `Hay ${senales.obligacionesVencidas} obligaciones vencidas.`,
    };
  }

  if (senales.presupuestoExcedido) {
    return { estado: "riesgo", motivo: "El presupuesto del período está excedido." };
  }

  if (senales.generaIngresos && senales.flujoUltimos3Meses < 0) {
    return { estado: "riesgo", motivo: "Flujo de caja negativo en los últimos 3 meses." };
  }

  if (senales.obligacionesPorVencer7Dias > 0) {
    return {
      estado: "observacion",
      motivo:
        senales.obligacionesPorVencer7Dias === 1
          ? "Hay 1 obligación por vencer en los próximos 7 días."
          : `Hay ${senales.obligacionesPorVencer7Dias} obligaciones por vencer en los próximos 7 días.`,
    };
  }

  const ejecucion = senales.ejecucionPresupuesto;
  if (ejecucion !== null && ejecucion >= 0.8) {
    return { estado: "observacion", motivo: "El presupuesto supera el 80 % de ejecución." };
  }

  return { estado: "saludable", motivo: "Sin obligaciones vencidas ni desviaciones." };
}
