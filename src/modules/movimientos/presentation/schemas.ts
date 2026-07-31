import { z } from "zod";
import { aNumero } from "@/shared/utils/formato";
import {
  ESTADOS_MOVIMIENTO,
  NATURALEZAS,
  TIPOS_MOVIMIENTO,
  naturalezaEsCompatible,
} from "@/shared/domain/enumeraciones";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato AAAA-MM-DD.");

const fechaOpcional = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === "" || v === undefined || v === null ? null : v))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Usa el formato AAAA-MM-DD.");

/** Acepta el numero o la cadena con separadores de miles del formulario. */
const valorMonetario = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (typeof v === "number") return v;
    return aNumero(v);
  })
  .refine((v) => Number.isFinite(v), "Escribe un valor numérico.")
  .refine((v) => v > 0, "El valor debe ser mayor que cero.");

const valorMonetarioOpcional = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    return aNumero(v);
  })
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Escribe un valor numérico válido.");

const camposComunes = {
  proyectoId: z.string().uuid("Selecciona un proyecto."),
  categoriaId: z.string().uuid("Selecciona una categoría."),
  metodoPagoId: z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v)),
  tipo: z.enum(TIPOS_MOVIMIENTO),
  /** RF-21: sobreescritura opcional de la naturaleza propuesta. */
  naturaleza: z.enum(NATURALEZAS).optional(),
  fecha,
  fechaVencimiento: fechaOpcional,
  valor: valorMonetario,
  descripcion: z
    .string()
    .min(1, "La descripción es obligatoria.")
    .max(200, "La descripción no puede superar 200 caracteres.")
    .transform((v) => v.trim()),
  observaciones: z
    .string()
    .max(2000)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null)),
  abonoCapital: valorMonetarioOpcional,
  abonoInteres: valorMonetarioOpcional,
};

/**
 * Coherencia tipo/naturaleza y desglose de credito
 * (invariantes §5.7.3 y RF-29). Se aplica con superRefine para no depender
 * de genericos y mantener el tipado exacto de cada esquema.
 */
type CamposValidables = {
  tipo: (typeof TIPOS_MOVIMIENTO)[number];
  naturaleza?: (typeof NATURALEZAS)[number] | undefined;
  valor: number;
  abonoCapital: number | null;
  abonoInteres: number | null;
};

function validarCoherencia(d: CamposValidables, ctx: z.RefinementCtx): void {
  if (d.naturaleza && !naturalezaEsCompatible(d.tipo, d.naturaleza)) {
    ctx.addIssue({
      code: "custom",
      message: "La naturaleza no aplica a este tipo de movimiento.",
      path: ["naturaleza"],
    });
  }

  const soloUno = (d.abonoCapital === null) !== (d.abonoInteres === null);
  if (soloUno) {
    ctx.addIssue({
      code: "custom",
      message: "Indica tanto el abono a capital como los intereses.",
      path: ["abonoCapital"],
    });
    return;
  }

  if (
    d.abonoCapital !== null &&
    d.abonoInteres !== null &&
    Math.round((d.abonoCapital + d.abonoInteres) * 100) !== Math.round(d.valor * 100)
  ) {
    ctx.addIssue({
      code: "custom",
      message: "La suma de capital e intereses debe ser igual al valor de la cuota.",
      path: ["abonoCapital"],
    });
  }
}

export const esquemaRegistrarMovimiento = z
  .object({
    ...camposComunes,
    estado: z.enum(["pendiente", "pagado"]).default("pendiente"),
    fechaPago: fechaOpcional,
  })
  .superRefine((d, ctx) => {
    validarCoherencia(d, ctx);
    if (d.estado === "pagado" && !d.metodoPagoId) {
      ctx.addIssue({
        code: "custom",
        message: "Un movimiento pagado debe indicar el método de pago.",
        path: ["metodoPagoId"],
      });
    }
  });

export const esquemaActualizarMovimiento = z
  .object({ id: z.string().uuid(), ...camposComunes })
  .superRefine(validarCoherencia);

export const esquemaMarcarPagado = z.object({
  id: z.string().uuid(),
  fechaPago: fecha,
  metodoPagoId: z.string().uuid("Selecciona el método de pago."),
});

export const esquemaAnularMovimiento = z.object({
  id: z.string().uuid(),
  motivo: z
    .string()
    .min(3, "Indica el motivo de la anulación (mínimo 3 caracteres).")
    .max(500)
    .transform((v) => v.trim()),
});

/** RF-27: carga en lote. El contenido llega como texto, no como archivo: el
 * navegador ya lo leyo y asi la accion no depende de FormData. */
export const esquemaImportacionCsv = z.object({
  contenido: z
    .string()
    .min(1, "Pega el contenido del CSV o selecciona un archivo.")
    .max(2_000_000, "El archivo es demasiado grande."),
  proyectoId: z
    .union([z.string().uuid(), z.literal(""), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});

/** RF-28: duplicar como plantilla. */
export const esquemaDuplicarMovimiento = z.object({
  id: z.string().uuid(),
  fecha: fechaOpcional,
});

/** RF-23: filtros que viajan en la URL para ser compartibles (RNF-09). */
export const esquemaFiltroMovimientos = z.object({
  proyectoId: z.string().uuid().optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  tipos: z.array(z.enum(TIPOS_MOVIMIENTO)).optional(),
  naturalezas: z.array(z.enum(NATURALEZAS)).optional(),
  categoriaIds: z.array(z.string().uuid()).optional(),
  estados: z.array(z.enum(ESTADOS_MOVIMIENTO)).optional(),
  metodoPagoId: z.string().uuid().optional(),
  texto: z.string().max(200).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  ordenCampo: z.enum(["fecha", "valor", "categoria", "estado"]).default("fecha"),
  ordenDireccion: z.enum(["asc", "desc"]).default("desc"),
});

export type DatosRegistrarMovimiento = z.input<typeof esquemaRegistrarMovimiento>;
export type DatosActualizarMovimiento = z.input<typeof esquemaActualizarMovimiento>;
export type DatosFiltroMovimientos = z.output<typeof esquemaFiltroMovimientos>;
