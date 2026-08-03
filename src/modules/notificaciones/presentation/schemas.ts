import { z } from "zod";

/** Esquemas compartidos por la campana y la Server Action (RNF-07). */

export const esquemaMarcarAvisoLeido = z.object({
  id: z.string().uuid("El aviso no es válido."),
});

/**
 * Marcar todo como leído no lleva datos, pero pasa por el mismo validador que el
 * resto: `ejecutarAccion` es lo que traduce cualquier error a un `Resultado` en
 * lugar de dejar escapar una excepción al cliente (§8.6).
 */
export const esquemaMarcarTodosLeidos = z.object({}).default({});
