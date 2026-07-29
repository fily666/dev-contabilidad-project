import { z } from "zod";
import { ESTADOS_PROYECTO } from "@/shared/domain/enumeraciones";

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "La fecha no es válida.");

const fechaOpcional = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === undefined ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Usa el formato AAAA-MM-DD.");

const base = {
  tipoProyectoId: z.string().uuid("Selecciona un tipo de proyecto."),
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio.")
    .max(120, "El nombre no puede superar 120 caracteres.")
    .transform((v) => v.trim()),
  descripcion: z
    .string()
    .max(1000, "La descripción es demasiado larga.")
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  fechaInicio: fecha,
  fechaFin: fechaOpcional,
  /** Atributos dinamicos del tipo; su validacion fina la hace el dominio (§13). */
  atributos: z.record(z.string(), z.unknown()).optional().default({}),
};

export const esquemaCrearProyecto = z
  .object({ ...base, moneda: z.string().length(3).optional().default("COP") })
  .refine((d) => d.fechaFin === null || d.fechaFin >= d.fechaInicio, {
    message: "La fecha de cierre no puede ser anterior a la de inicio.",
    path: ["fechaFin"],
  });

export const esquemaActualizarProyecto = z
  .object({ id: z.string().uuid(), ...base })
  .refine((d) => d.fechaFin === null || d.fechaFin >= d.fechaInicio, {
    message: "La fecha de cierre no puede ser anterior a la de inicio.",
    path: ["fechaFin"],
  });

export const esquemaCambiarEstadoProyecto = z.object({
  id: z.string().uuid(),
  estado: z.enum(ESTADOS_PROYECTO),
});

export const esquemaEliminarProyecto = z.object({ id: z.string().uuid() });

export type DatosCrearProyecto = z.input<typeof esquemaCrearProyecto>;
export type DatosActualizarProyecto = z.input<typeof esquemaActualizarProyecto>;
