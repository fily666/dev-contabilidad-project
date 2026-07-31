import { z } from "zod";

/** Esquemas compartidos por formulario y Server Action (RNF-07). */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.");

const monetario = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (typeof v === "number") return v;
    const limpio = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
    return Number(limpio.replace(",", "."));
  })
  .refine((v) => Number.isFinite(v) && v >= 0, "Escribe un valor numérico no negativo.");

const base = {
  /** Vacío significa presupuesto global, no de un proyecto (§6.3). */
  proyectoId: z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v)),
  categoriaId: z.string().uuid("Selecciona una categoría."),
  periodoInicio: fecha,
  periodoFin: fecha,
  valorPlaneado: monetario,
  notas: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
};

function validarPeriodo(
  d: { periodoInicio: string; periodoFin: string },
  ctx: z.RefinementCtx,
): void {
  if (d.periodoFin < d.periodoInicio) {
    ctx.addIssue({
      code: "custom",
      message: "El fin del periodo no puede ser anterior al inicio.",
      path: ["periodoFin"],
    });
  }
}

/** RF-80. */
export const esquemaCrearPresupuesto = z.object(base).superRefine(validarPeriodo);

export const esquemaActualizarPresupuesto = z
  .object({ id: z.string().uuid(), ...base })
  .superRefine(validarPeriodo);

export const esquemaEliminarPresupuesto = z.object({ id: z.string().uuid() });

/** RF-83: copiar el periodo al siguiente. */
export const esquemaCopiarPresupuestos = z
  .object({
    proyectoId: z
      .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
      .transform((v) => (v === "" || v === undefined ? null : v)),
    periodoInicio: fecha,
    periodoFin: fecha,
  })
  .superRefine(validarPeriodo);

export type DatosCrearPresupuesto = z.input<typeof esquemaCrearPresupuesto>;
