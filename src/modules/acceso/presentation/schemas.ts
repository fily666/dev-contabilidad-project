import { z } from "zod";

import {
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

/** RF-03 y RF-101. */
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
});

export type DatosAcceso = z.input<typeof esquemaAcceso>;
export type DatosAjustes = z.input<typeof esquemaAjustes>;
