import { z } from "zod";
import { TIPOS_DOCUMENTO } from "@/shared/domain/enumeraciones";
import { MIMES_PERMITIDOS, TAMANO_MAXIMO_BYTES } from "../domain/documento.entity";

/**
 * El archivo viaja como `File` dentro de un FormData, asi que el esquema valida
 * el archivo mismo y no solo sus metadatos: es la unica forma de rechazar en el
 * servidor un tipo o un tamaño que el `accept` del navegador se salto (RNF-07).
 */
const archivo = z
  .custom<File>((valor) => typeof File !== "undefined" && valor instanceof File, {
    message: "Selecciona un archivo.",
  })
  .refine((f) => f.size > 0, "El archivo está vacío.")
  .refine((f) => f.size <= TAMANO_MAXIMO_BYTES, "El archivo supera el máximo de 10 MB.")
  .refine(
    (f) => Object.hasOwn(MIMES_PERMITIDOS, f.type),
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
