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

/**
 * Ritmo de ejecución: cuánto se ha gastado frente a cuánto periodo ha pasado.
 *
 * Es la pregunta que faltaba. Un 60 % de ejecución no dice nada por sí solo: en
 * octubre es sano y en marzo es una alarma, y la vista mostraba el 60 % sin más.
 * Con el ritmo, `1,0` es ir al día, `1,5` es gastar a vez y media la velocidad del
 * calendario y `0,5` es ir sobrado.
 *
 * `null` cuando no hay ejecución calculable, cuando el periodo no ha empezado —no
 * se puede ir rápido antes de empezar— o cuando ya terminó, porque entonces el
 * ritmo deja de ser una advertencia y la cifra que importa es la ejecución final.
 */
export function ritmoDeEjecucion(entrada: {
  ejecucion: number | null;
  periodoInicio: string;
  periodoFin: string;
  hoy: string;
}): number | null {
  const { ejecucion, periodoInicio, periodoFin, hoy } = entrada;
  if (ejecucion === null || !Number.isFinite(ejecucion)) return null;
  if (hoy < periodoInicio || hoy > periodoFin) return null;

  const dia = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
  const total = dia(periodoFin) - dia(periodoInicio);
  if (!Number.isFinite(total) || total <= 0) return null;

  // +1 día: el primer día del periodo ya cuenta como transcurrido.
  const transcurrido = (dia(hoy) - dia(periodoInicio)) / total;
  const fraccion = Math.min(1, Math.max(1 / 365, transcurrido));

  return ejecucion / fraccion;
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
