import { z } from "zod";
import { TIPOS_DOCUMENTO } from "@/shared/domain/enumeraciones";
import {
  MIMES_COMPROBANTE,
  MIMES_PERMITIDOS,
  TAMANO_MAXIMO_BYTES,
  TAMANO_MAXIMO_LEGIBLE,
} from "../domain/documento.entity";

/**
 * El archivo viaja como `File` dentro de un FormData, asi que el esquema valida
 * el archivo mismo y no solo sus metadatos: es la unica forma de rechazar en el
 * servidor un tipo o un tamaño que el `accept` del navegador se salto (RNF-07).
 */
function esquemaArchivo(mimes: readonly string[], mensajeTipo: string) {
  return z
    .custom<File>((valor) => typeof File !== "undefined" && valor instanceof File, {
      message: "Selecciona un archivo.",
    })
    .refine((f) => f.size > 0, "El archivo está vacío.")
    .refine(
      (f) => f.size <= TAMANO_MAXIMO_BYTES,
      `El archivo supera el máximo de ${TAMANO_MAXIMO_LEGIBLE}.`,
    )
    .refine((f) => mimes.includes(f.type), mensajeTipo);
}

const archivo = esquemaArchivo(
  Object.keys(MIMES_PERMITIDOS),
  "Solo se admiten PDF, JPG, PNG, WEBP, XLSX y DOCX.",
);

/** RF-40 a RF-43. */
export const esquemaSubirDocumento = z.object({
  proyectoId: z.string().uuid("Selecciona un proyecto."),
  movimientoId: z
    .union([z.string().uuid(), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined ? null : v)),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO).default("otro"),
  archivo,
});

/**
 * RF-40: soporte adjuntado desde el formulario de un movimiento. Se separa del
 * anterior porque exige movimiento y acota los tipos al comprobante de un pago.
 */
export const esquemaSubirComprobante = z.object({
  proyectoId: z.string().uuid("Selecciona un proyecto."),
  movimientoId: z.string().uuid(),
  tipoDocumento: z.enum(TIPOS_DOCUMENTO).default("comprobante"),
  archivo: esquemaArchivo(MIMES_COMPROBANTE, "Solo se admiten PDF, JPG, PNG y WEBP."),
});

export const esquemaDocumentoPorId = z.object({ id: z.string().uuid() });

/** RF-47: filtros de la búsqueda documental, persistidos en la URL (RNF-09). */
export const esquemaFiltroDocumentos = z.object({
  proyectoId: z.string().uuid().optional(),
  tipos: z.array(z.enum(TIPOS_DOCUMENTO)).optional(),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  texto: z.string().max(200).optional(),
});

/** `accept` del input, derivado del catálogo de MIME permitidos. */
export const ACCEPT_ARCHIVOS = Object.entries(MIMES_PERMITIDOS)
  .map(([mime, extension]) => `${mime},${extension}`)
  .join(",");

/** `accept` del input de comprobantes (RF-40): solo PDF e imágenes. */
export const ACCEPT_COMPROBANTES = MIMES_COMPROBANTE.map(
  (mime) => `${mime},${MIMES_PERMITIDOS[mime] ?? ""}`,
).join(",");
