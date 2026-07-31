import { z } from "zod";
import { aNumero } from "@/shared/utils/formato";
import { FRECUENCIAS } from "@/shared/domain/enumeraciones";

/** Esquemas compartidos por formulario y Server Action (RNF-07). */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.");

const valorMonetario = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (typeof v === "number") return v;
    return aNumero(v);
  })
  .refine((v) => Number.isFinite(v), "Escribe un valor numérico.")
  .refine((v) => v >= 0, "El valor estimado no puede ser negativo.");

/**
 * Los dias de aviso llegan como texto libre («5, 1») porque un campo por dia
 * seria una jaula: el usuario quiere escribirlos, no administrarlos.
 */
const diasAviso = z
  .union([z.string(), z.array(z.number()), z.undefined(), z.null()])
  .transform((v) => {
    if (v === undefined || v === null) return undefined;
    if (Array.isArray(v)) return v;
    const numeros = v
      .split(/[,\s]+/)
      .map((t) => Number(t.trim()))
      .filter((n) => Number.isInteger(n));
    return numeros.length > 0 ? numeros : undefined;
  })
  .refine(
    (v) => v === undefined || v.every((n) => n >= 0 && n <= 90),
    "Los días de aviso deben estar entre 0 y 90.",
  );

const camposComunes = {
  categoriaId: z.string().uuid("Selecciona una categoría."),
  concepto: z
    .string()
    .min(1, "El concepto es obligatorio.")
    .max(150, "El concepto no puede superar 150 caracteres.")
    .transform((v) => v.trim()),
  valorEstimado: valorMonetario,
  fechaVencimiento: fecha,
  frecuencia: z.enum(FRECUENCIAS),
  intervaloMeses: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
    })
    .refine((v) => v === null || Number.isInteger(v), "Escribe el intervalo en meses completos."),
  diasAviso,
  crearMovimientoAuto: z.coerce.boolean().optional(),
};

/** RF-51: la frecuencia personalizada exige intervalo; las demás lo descartan. */
function validarIntervalo(
  d: { frecuencia: (typeof FRECUENCIAS)[number]; intervaloMeses: number | null },
  ctx: z.RefinementCtx,
): void {
  if (d.frecuencia !== "personalizada") return;
  if (d.intervaloMeses === null || d.intervaloMeses < 1 || d.intervaloMeses > 60) {
    ctx.addIssue({
      code: "custom",
      message: "Indica cada cuántos meses se repite (entre 1 y 60).",
      path: ["intervaloMeses"],
    });
  }
}

export const esquemaCrearObligacion = z
  .object({ proyectoId: z.string().uuid("Selecciona un proyecto."), ...camposComunes })
  .superRefine(validarIntervalo);

export const esquemaActualizarObligacion = z
  .object({ id: z.string().uuid(), ...camposComunes })
  .superRefine(validarIntervalo);

export const esquemaCambiarEstadoObligacion = z.object({
  id: z.string().uuid(),
  activa: z.coerce.boolean(),
});

export const esquemaEliminarObligacion = z.object({ id: z.string().uuid() });

/** RF-54. */
export const esquemaPagarOcurrencia = z.object({
  ocurrenciaId: z.string().uuid(),
  metodoPagoId: z.string().uuid("Selecciona el método de pago."),
  valor: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined || v === "") return undefined;
      if (typeof v === "number") return v;
      return aNumero(v);
    })
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0), "Escribe el valor pagado."),
  fechaPago: fecha.optional(),
  observaciones: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

/** RF-56. */
export const esquemaCambiarEstadoOcurrencia = z.object({
  id: z.string().uuid(),
  omitir: z.coerce.boolean(),
});

export type DatosCrearObligacion = z.input<typeof esquemaCrearObligacion>;
export type DatosActualizarObligacion = z.input<typeof esquemaActualizarObligacion>;
