import { z } from "zod";

/** Esquemas compartidos por formulario y Server Action (Contexto.md §8.7). */

export const esquemaAcceso = z.object({
  // Sin minimo ni maximo: la validacion real es "coincide o no coincide" y la
  // hace el caso de uso. Poner reglas de forma aqui solo le contaria a quien lo
  // intenta como es el token.
  token: z.string().min(1, "Escribe el token de acceso."),
});

export const esquemaAjustes = z.object({
  moneda: z
    .string()
    .length(3, "Usa el código ISO de 3 letras, por ejemplo COP.")
    .transform((v) => v.toUpperCase()),
  zonaHoraria: z.string().min(1, "Selecciona una zona horaria."),
});

export type DatosAcceso = z.input<typeof esquemaAcceso>;
export type DatosAjustes = z.input<typeof esquemaAjustes>;
