/**
 * Resultado de una operacion expuesta a la presentacion. Contexto.md §8.6:
 * las Server Actions nunca lanzan excepciones al cliente.
 */
export type Resultado<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      codigo: string;
      mensaje: string;
      camposConError?: Record<string, string[]>;
    };

export function exito<T>(data: T): Resultado<T> {
  return { ok: true, data };
}

export function fallo<T = never>(
  codigo: string,
  mensaje: string,
  camposConError?: Record<string, string[]>,
): Resultado<T> {
  return { ok: false, codigo, mensaje, camposConError };
}
