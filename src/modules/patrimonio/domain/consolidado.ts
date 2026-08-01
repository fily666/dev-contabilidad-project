import { Dinero } from "@/shared/domain/dinero";
import type { PatrimonioProyecto } from "./patrimonio.repository";

/**
 * RF-78: consolidado de patrimonio.
 *
 * Activos son las valoraciones registradas, no lo invertido: lo que costo un
 * apartamento y lo que vale hoy son dos cifras distintas, y confundirlas es el
 * error que este panel existe para evitar. Un proyecto sin valoracion no aporta
 * activo, y se dice cuantos hay para que el total no se lea como completo.
 */
export type ConsolidadoPatrimonio = {
  activos: number;
  pasivos: number;
  patrimonioNeto: number;
  totalInvertido: number;
  /** Retorno total: (resultado acumulado + plusvalía) / invertido (§5.3). */
  retornoTotal: number | null;
  /** Proyectos sin valoración registrada: su activo no está contado. */
  sinValoracion: number;
  /**
   * Plusvalía consolidada: valoración − invertido, solo de los proyectos que
   * tienen valoración.
   *
   * Es la respuesta a «¿se está valorizando?», que es una de las dos preguntas del
   * módulo y no se mostraba en ninguna parte: la vista comparaba valoración con
   * pasivo —cuánto se debe— y nunca valoración con lo invertido.
   */
  plusvalia: number;
  /**
   * LTV consolidado: pasivo ÷ valoración. `null` si no hay ninguna valoración.
   *
   * Es el indicador de riesgo del módulo —qué parte del activo es deuda— y sale de
   * dos columnas que ya se leían.
   */
  ltv: number | null;
  moneda: string;
};

export function consolidar(
  filas: readonly PatrimonioProyecto[],
  monedaPorOmision = "COP",
): ConsolidadoPatrimonio {
  const moneda = filas[0]?.moneda ?? monedaPorOmision;

  const activos = filas.reduce((suma, f) => suma + (f.valoracionActual ?? 0), 0);
  const pasivos = filas.reduce((suma, f) => suma + f.pasivoTotal, 0);
  const invertido = filas.reduce((suma, f) => suma + f.totalInvertido, 0);
  const ingresos = filas.reduce((suma, f) => suma + f.totalIngresos, 0);
  const egresos = filas.reduce((suma, f) => suma + f.totalEgresos, 0);

  // Solo se computa plusvalia de los proyectos que tienen valoracion; sumar la
  // inversion de los que no la tienen restaria una plusvalia inventada.
  const conValoracion = filas.filter((f) => f.valoracionActual !== null);
  const invertidoConValoracion = conValoracion.reduce((suma, f) => suma + f.totalInvertido, 0);
  const valoradoActual = conValoracion.reduce((suma, f) => suma + (f.valoracionActual ?? 0), 0);

  const resultado = Dinero.de(ingresos, moneda).menos(Dinero.de(egresos, moneda));
  const plusvalia = Dinero.de(valoradoActual, moneda).menos(
    Dinero.de(invertidoConValoracion, moneda),
  );

  return {
    activos,
    pasivos,
    patrimonioNeto: Dinero.de(activos, moneda).menos(Dinero.de(pasivos, moneda)).valor,
    totalInvertido: invertido,
    retornoTotal: resultado.mas(plusvalia).dividido(Dinero.de(invertido, moneda)),
    sinValoracion: filas.length - conValoracion.length,
    plusvalia: plusvalia.valor,
    // Sobre el valorado, no sobre `activos`: son lo mismo hoy, pero atarlo a la
    // base de la plusvalia deja claro que un proyecto sin valoracion no participa.
    ltv: Dinero.de(pasivos, moneda).dividido(Dinero.de(valoradoActual, moneda)),
    moneda,
  };
}

/** Plusvalía de un proyecto: `null` cuando no hay valoración con la que medirla. */
export function plusvaliaDelProyecto(fila: PatrimonioProyecto): number | null {
  if (fila.valoracionActual === null) return null;
  return Dinero.de(fila.valoracionActual, fila.moneda).menos(
    Dinero.de(fila.totalInvertido, fila.moneda),
  ).valor;
}

/**
 * LTV de un proyecto: pasivo ÷ valoración.
 *
 * `null` sin valoración —no hay base— y también con valoración cero, por la guarda
 * de §5.3. Un proyecto sin deuda da 0, que sí es una respuesta.
 */
export function ltvDelProyecto(fila: PatrimonioProyecto): number | null {
  if (fila.valoracionActual === null) return null;
  return Dinero.de(fila.pasivoTotal, fila.moneda).dividido(
    Dinero.de(fila.valoracionActual, fila.moneda),
  );
}

/** Retorno de un solo proyecto, con la misma formula (§5.3). */
export function retornoDelProyecto(fila: PatrimonioProyecto): number | null {
  const resultado = Dinero.de(fila.totalIngresos, fila.moneda).menos(
    Dinero.de(fila.totalEgresos, fila.moneda),
  );
  const plusvalia =
    fila.valoracionActual === null
      ? Dinero.de(0, fila.moneda)
      : Dinero.de(fila.valoracionActual, fila.moneda).menos(
          Dinero.de(fila.totalInvertido, fila.moneda),
        );

  return resultado.mas(plusvalia).dividido(Dinero.de(fila.totalInvertido, fila.moneda));
}
