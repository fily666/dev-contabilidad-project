/**
 * Puertos del acceso monousuario (Contexto.md §7.3, §9).
 *
 * No hay usuarios ni perfiles: hay UNA credencial configurada y UNA sesion
 * abierta o cerrada. Lo que antes era el perfil de una persona son ahora los
 * ajustes de la instalacion.
 */

/**
 * Formatos de fecha ofrecidos (RF-101). Son patrones de date-fns, no cadenas
 * libres: el conjunto cerrado es lo que permite validarlo en el dominio.
 */
export const FORMATOS_FECHA = ["d MMM yyyy", "dd/MM/yyyy", "yyyy-MM-dd"] as const;
export type FormatoFecha = (typeof FORMATOS_FECHA)[number];

/** Horizonte de proyeccion por omision (§5.6, §17). */
export const HORIZONTE_PROYECCION_MESES = 12;
export const HORIZONTE_PROYECCION_MINIMO = 1;
export const HORIZONTE_PROYECCION_MAXIMO = 60;

/** Preferencias de la instalacion. Fila unica de la tabla `ajustes`. */
export type Ajustes = {
  moneda: string;
  zonaHoraria: string;
  /** RF-101: con que patron se presentan las fechas en toda la interfaz. */
  formatoFecha: FormatoFecha;
  /** RF-101: meses que abarcan las proyecciones y la generacion de ocurrencias. */
  horizonteProyeccionMeses: number;
};

export const AJUSTES_POR_OMISION: Ajustes = {
  moneda: "COP",
  zonaHoraria: "America/Bogota",
  formatoFecha: "d MMM yyyy",
  horizonteProyeccionMeses: HORIZONTE_PROYECCION_MESES,
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
