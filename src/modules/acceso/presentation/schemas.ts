import { z } from "zod";

import {
  CANALES_DISPONIBLES,
  FORMATOS_FECHA,
  HORIZONTE_PROYECCION_MAXIMO,
  HORIZONTE_PROYECCION_MINIMO,
} from "../domain/sesion";

/** Esquemas compartidos por formulario y Server Action (Contexto.md §8.7). */

export const esquemaAcceso = z.object({
  // Sin minimo ni maximo: la validacion real es "coincide o no coincide" y la
  // hace el caso de uso. Poner reglas de forma aqui solo le contaria a quien lo
  // intenta como es el token.
  token: z.string().min(1, "Escribe el token de acceso."),
});

/** RF-03, RF-101 y RF-102. */
export const esquemaAjustes = z.object({
  moneda: z
    .string()
    .length(3, "Usa el código ISO de 3 letras, por ejemplo COP.")
    .transform((v) => v.toUpperCase()),
  zonaHoraria: z.string().min(1, "Selecciona una zona horaria."),
  formatoFecha: z.enum(FORMATOS_FECHA, {
    errorMap: () => ({ message: "Selecciona uno de los formatos disponibles." }),
  }),
  // El campo del formulario llega como cadena; se convierte antes de validar el
  // rango para que el mensaje hable de meses y no de tipos.
  horizonteProyeccionMeses: z.coerce
    .number({ invalid_type_error: "Escribe el horizonte en meses." })
    .int("El horizonte se expresa en meses completos.")
    .min(HORIZONTE_PROYECCION_MINIMO, `Mínimo ${HORIZONTE_PROYECCION_MINIMO} mes.`)
    .max(HORIZONTE_PROYECCION_MAXIMO, `Máximo ${HORIZONTE_PROYECCION_MAXIMO} meses.`),

  /** RF-102: canales activos. */
  canalesNotificacion: z
    .union([z.array(z.enum(CANALES_DISPONIBLES)), z.string(), z.undefined()])
    .transform((v) => {
      if (v === undefined) return undefined;
      if (Array.isArray(v)) return v;
      const partes = v
        .split(",")
        .map((p) => p.trim())
        .filter((p): p is (typeof CANALES_DISPONIBLES)[number] =>
          (CANALES_DISPONIBLES as readonly string[]).includes(p),
        );
      return partes;
    }),

  /** RF-102: días de anticipación por omisión, como «5, 1». */
  diasAvisoPorOmision: z
    .union([z.array(z.number()), z.string(), z.undefined()])
    .transform((v) => {
      if (v === undefined) return undefined;
      if (Array.isArray(v)) return v;
      const numeros = v
        .split(/[,\s]+/)
        .map((t) => Number(t.trim()))
        .filter((n) => Number.isInteger(n));
      return numeros;
    })
    .refine(
      (v) => v === undefined || v.every((n) => n >= 0 && n <= 90),
      "Los días de aviso deben estar entre 0 y 90.",
    ),

  /** RF-102: destinatario de los correos. */
  emailDestino: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v === undefined || v === null || v.trim() === "" ? null : v.trim()))
    .refine(
      (v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      "Escribe un correo válido o déjalo vacío.",
    ),
});

export type DatosAcceso = z.input<typeof esquemaAcceso>;
export type DatosAjustes = z.input<typeof esquemaAjustes>;
