/**
 * Puertos del acceso monousuario (Contexto.md §7.3, §9).
 *
 * No hay usuarios ni perfiles: hay UNA credencial configurada y UNA sesion
 * abierta o cerrada. Lo que antes era el perfil de una persona son ahora los
 * ajustes de la instalacion.
 */

/** Preferencias de la instalacion. Fila unica de la tabla `ajustes`. */
export type Ajustes = {
  moneda: string;
  zonaHoraria: string;
};

export const AJUSTES_POR_OMISION: Ajustes = {
  moneda: "COP",
  zonaHoraria: "America/Bogota",
};

/** PUERTO: la credencial configurada en el entorno. */
export interface CredencialAcceso {
  /** Token de acceso esperado (TOKEN_ACCESO). */
  token(): string;
  /** Secreto con el que se firma la cookie de sesion (SECRETO_SESION). */
  secretoSesion(): string;
}

/** PUERTO: donde se guarda la sesion del navegador. */
export interface AlmacenSesion {
  leer(): Promise<string | null>;
  escribir(valor: string, duracionSegundos: number): Promise<void>;
  borrar(): Promise<void>;
}

/** PUERTO de los ajustes (RF-03). */
export interface AjustesRepository {
  obtener(): Promise<Ajustes>;
  actualizar(datos: Partial<Ajustes>): Promise<Ajustes>;
}
