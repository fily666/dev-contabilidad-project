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
    moneda,
  };
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
