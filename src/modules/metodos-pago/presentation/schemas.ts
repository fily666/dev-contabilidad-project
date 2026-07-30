import { z } from "zod";
import { TIPOS_METODO_PAGO } from "@/shared/domain/enumeraciones";

/** RF-33. Un esquema por operacion, compartido por formulario y accion (§8.7). */

export const esquemaMetodoPago = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio.")
    .max(60, "El nombre no puede superar 60 caracteres.")
    .transform((v) => v.trim()),
  tipo: z.enum(TIPOS_METODO_PAGO),
  ultimosDigitos: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v?.trim() ? v.trim() : null))
    .refine((v) => v === null || /^[0-9]{2,4}$/.test(v), "Escribe entre 2 y 4 dígitos."),
});

export const esquemaActualizarMetodoPago = esquemaMetodoPago.extend({
  id: z.string().uuid(),
  activo: z.boolean().optional(),
});

export const esquemaEliminarMetodoPago = z.object({ id: z.string().uuid() });

export type DatosMetodoPago = z.input<typeof esquemaMetodoPago>;
