import { z } from "zod";
import { ESTADOS_PROYECTO } from "@/shared/domain/enumeraciones";
import { TIPOS_ATRIBUTO } from "@/modules/proyectos/domain/tipo-proyecto.entity";

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

/**
 * RF-100: definicion de un tipo de proyecto propio. Los atributos y los
 * indicadores viajan como arreglos y se guardan en `configuracion` (JSONB), que
 * es el mecanismo de §13: un tipo nuevo no cuesta una migracion.
 */
const atributoDinamico = z.object({
  clave: z
    .string()
    .min(1, "La clave es obligatoria.")
    .max(40)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "La clave va en minúsculas, sin tildes ni espacios (es un identificador).",
    ),
  etiqueta: z
    .string()
    .min(1, "La etiqueta es obligatoria.")
    .max(60)
    .transform((v) => v.trim()),
  tipo: z.enum(TIPOS_ATRIBUTO),
  requerido: z.coerce.boolean().default(false),
});

const baseTipo = {
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio.")
    .max(60, "El nombre no puede superar 60 caracteres.")
    .transform((v) => v.trim()),
  icono: z
    .string()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  atributos: z.array(atributoDinamico).max(20, "Veinte atributos son más que suficientes."),
  indicadores: z.array(z.string().min(1)).max(20),
  generaIngresos: z.coerce.boolean().default(true),
  seValoriza: z.coerce.boolean().default(false),
};

export const esquemaCrearTipoProyecto = z.object({
  codigo: z
    .string()
    .min(2, "El código debe tener al menos 2 caracteres.")
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, "El código va en minúsculas, sin tildes ni espacios."),
  ...baseTipo,
});

export const esquemaActualizarTipoProyecto = z.object({
  id: z.string().uuid(),
  ...baseTipo,
});

export const esquemaCambiarEstadoTipoProyecto = z.object({
  id: z.string().uuid(),
  activo: z.coerce.boolean(),
});

export const esquemaEliminarTipoProyecto = z.object({ id: z.string().uuid() });

export type DatosCrearTipoProyecto = z.input<typeof esquemaCrearTipoProyecto>;
