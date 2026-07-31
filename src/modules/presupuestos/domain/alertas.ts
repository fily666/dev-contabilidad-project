/**
 * RF-82: alerta visual al superar el 80 % y el 100 % del presupuesto.
 *
 * Los umbrales viven en el dominio y no en el componente: son una regla de
 * negocio, y §5.5 los usa tambien para el semaforo del estado financiero del
 * proyecto.
 */

export const UMBRAL_AVISO = 0.8;
export const UMBRAL_EXCEDIDO = 1;

export const NIVELES_ALERTA = ["ok", "aviso", "excedido"] as const;
export type NivelAlerta = (typeof NIVELES_ALERTA)[number];

/**
 * `ejecucion` es el tanto por uno gastado sobre lo planeado. `null` cuando no es
 * calculable (planeado en cero): entonces no hay alerta que dar, ni buena ni
 * mala (guarda de §5.3).
 */
export function nivelDeAlerta(ejecucion: number | null): NivelAlerta | null {
  if (ejecucion === null || !Number.isFinite(ejecucion)) return null;
  if (ejecucion >= UMBRAL_EXCEDIDO) return "excedido";
  if (ejecucion >= UMBRAL_AVISO) return "aviso";
  return "ok";
}

export type ResumenEjecucion = {
  planeado: number;
  real: number;
  desviacion: number;
  ejecucion: number | null;
  excedidos: number;
  enAviso: number;
};

/** Consolidado de un conjunto de presupuestos, para la cabecera de la vista. */
export function resumirEjecucion(
  filas: readonly { valorPlaneado: number; valorReal: number; ejecucion: number | null }[],
): ResumenEjecucion {
  const planeado = filas.reduce((s, f) => s + f.valorPlaneado, 0);
  const real = filas.reduce((s, f) => s + f.valorReal, 0);
  const niveles = filas.map((f) => nivelDeAlerta(f.ejecucion));

  return {
    planeado,
    real,
    desviacion: Math.round((real - planeado) * 100) / 100,
    ejecucion: planeado > 0 ? real / planeado : null,
    excedidos: niveles.filter((n) => n === "excedido").length,
    enAviso: niveles.filter((n) => n === "aviso").length,
  };
}
