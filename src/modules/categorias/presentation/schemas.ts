import { z } from "zod";
import { NATURALEZAS } from "@/shared/domain/enumeraciones";

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

export type DatosCrearCategoria = z.input<typeof esquemaCrearCategoria>;
