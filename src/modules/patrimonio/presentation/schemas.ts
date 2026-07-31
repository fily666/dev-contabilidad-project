import { z } from "zod";
import { TIPOS_PASIVO } from "../domain/pasivo.entity";

/** Esquemas compartidos por formulario y Server Action (RNF-07). */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.");

const monetario = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (typeof v === "number") return v;
    const limpio = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
    return Number(limpio.replace(",", "."));
  })
  .refine((v) => Number.isFinite(v), "Escribe un valor numérico.");

const monetarioOpcional = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    const limpio = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
    return Number(limpio.replace(",", "."));
  })
  .refine((v) => v === null || Number.isFinite(v), "Escribe un valor numérico válido.");

const enteroOpcional = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
  })
  .refine((v) => v === null || Number.isInteger(v), "Escribe un número entero.");

/**
 * La tasa se escribe como porcentaje («12,5») porque así llega el extracto del
 * banco, y se guarda en tanto por uno, que es lo que espera el dominio.
 */
const tasaOpcional = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.round((n / 100) * 10_000) / 10_000 : Number.NaN;
  })
  .refine(
    (v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 2),
    "La tasa E.A. no es válida.",
  );

const basePasivo = {
  nombre: z
    .string()
    .min(1, "El nombre es obligatorio.")
    .max(120)
    .transform((v) => v.trim()),
  tipo: z.enum(TIPOS_PASIVO),
  montoOriginal: monetario.refine((v) => v > 0, "El monto original debe ser mayor que cero."),
  saldoActual: monetario.refine((v) => v >= 0, "El saldo no puede ser negativo."),
  tasaInteresEa: tasaOpcional,
  plazoMeses: enteroOpcional,
  valorCuota: monetarioOpcional,
  fechaDesembolso: fecha,
};

/** RF-17. */
export const esquemaCrearPasivo = z.object({
  proyectoId: z.string().uuid("Selecciona un proyecto."),
  ...basePasivo,
});

export const esquemaActualizarPasivo = z.object({ id: z.string().uuid(), ...basePasivo });

export const esquemaAbonarACapital = z.object({
  id: z.string().uuid(),
  valor: monetario.refine((v) => v > 0, "El abono debe ser mayor que cero."),
});

export const esquemaCambiarEstadoPasivo = z.object({
  id: z.string().uuid(),
  activo: z.coerce.boolean(),
});

export const esquemaEliminarPasivo = z.object({ id: z.string().uuid() });

/** RF-16. */
export const esquemaRegistrarValoracion = z.object({
  proyectoId: z.string().uuid("Selecciona un proyecto."),
  fecha,
  valor: monetario.refine((v) => v >= 0, "El valor comercial no puede ser negativo."),
  fuente: z
    .string()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  notas: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
});

export const esquemaEliminarValoracion = z.object({ id: z.string().uuid() });
