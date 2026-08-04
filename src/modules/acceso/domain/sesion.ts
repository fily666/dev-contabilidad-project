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

/** RF-102: canales por los que se avisa. `in_app` no necesita configuracion. */
export const CANALES_DISPONIBLES = ["email", "whatsapp", "in_app"] as const;
export type CanalAviso = (typeof CANALES_DISPONIBLES)[number];

/** Dias de anticipacion por omision cuando la obligacion no los declara (RF-53). */
export const DIAS_AVISO_POR_OMISION = [5, 1];

/** Preferencias de la instalacion. Fila unica de la tabla `ajustes`. */
export type Ajustes = {
  moneda: string;
  zonaHoraria: string;
  /** RF-101: con que patron se presentan las fechas en toda la interfaz. */
  formatoFecha: FormatoFecha;
  /** RF-101: meses que abarcan las proyecciones y la generacion de ocurrencias. */
  horizonteProyeccionMeses: number;
  /** RF-102: canales activos. Sin `email` no se programan correos. */
  canalesNotificacion: CanalAviso[];
  /** RF-102: dias de anticipacion por omision. */
  diasAvisoPorOmision: number[];
  /**
   * RF-102: a donde llegan los correos. Es un ajuste y no una variable de
   * entorno porque cambia sin desplegar, y porque en un sistema monousuario no
   * hay a quien preguntarselo: se escribe una vez y se olvida.
   */
  emailDestino: string | null;
  /**
   * RF-102, §17 P-3: numero de WhatsApp destino en formato E.164 (+573001234567).
   * Mismo razonamiento que `emailDestino`: es un ajuste, no una variable de
   * entorno. Sin adaptador de Meta configurado en el entorno, el canal queda
   * `programada` aunque este numero exista (§10.2).
   */
  whatsappDestino: string | null;
};

export const AJUSTES_POR_OMISION: Ajustes = {
  moneda: "COP",
  zonaHoraria: "America/Bogota",
  formatoFecha: "d MMM yyyy",
  horizonteProyeccionMeses: HORIZONTE_PROYECCION_MESES,
  canalesNotificacion: ["in_app"],
  diasAvisoPorOmision: DIAS_AVISO_POR_OMISION,
  emailDestino: null,
  whatsappDestino: null,
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
