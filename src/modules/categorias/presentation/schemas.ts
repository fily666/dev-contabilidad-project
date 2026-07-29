import { z } from "zod";
import { NATURALEZAS, TIPOS_METODO_PAGO } from "@/shared/domain/enumeraciones";

const nombre = z
  .string()
  .min(1, "El nombre es obligatorio.")
  .max(80, "El nombre no puede superar 80 caracteres.")
  .transform((v) => v.trim());

const opcionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === undefined ? null : v));

/** RF-31. */
export const esquemaCrearCategoria = z.object({
  nombre,
  naturaleza: z.enum(NATURALEZAS),
  tipoProyectoId: opcionalUuid,
  padreId: opcionalUuid,
});

export const esquemaActualizarCategoria = z.object({
  id: z.string().uuid(),
  nombre,
  naturaleza: z.enum(NATURALEZAS).optional(),
});

export const esquemaCambiarEstadoCategoria = z.object({
  id: z.string().uuid(),
  activa: z.boolean(),
});

export const esquemaEliminarCategoria = z.object({ id: z.string().uuid() });

/** RF-33. */
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

export type DatosCrearCategoria = z.input<typeof esquemaCrearCategoria>;
export type DatosMetodoPago = z.input<typeof esquemaMetodoPago>;
