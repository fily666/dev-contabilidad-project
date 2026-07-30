import { z } from "zod";
import { esErrorDeDominio } from "@/shared/domain/errores";
import { exito, fallo, type Resultado } from "@/shared/domain/resultado";
import { mensajeDeError } from "@/shared/utils/etiquetas";

/**
 * Envoltura de Server Actions (Contexto.md §8.6): valida con el mismo esquema
 * Zod del formulario, ejecuta el caso de uso y traduce cualquier error a un
 * Resultado. Nunca lanza excepciones al cliente.
 */
export async function ejecutarAccion<Esquema extends z.ZodTypeAny, Salida>(
  esquema: Esquema,
  datos: unknown,
  operacion: (entrada: z.output<Esquema>) => Promise<Salida>,
): Promise<Resultado<Salida>> {
  const validacion = esquema.safeParse(datos);

  if (!validacion.success) {
    const camposConError: Record<string, string[]> = {};
    for (const issue of validacion.error.issues) {
      const campo = issue.path.join(".") || "_";
      (camposConError[campo] ??= []).push(issue.message);
    }
    return fallo("DATOS_INVALIDOS", mensajeDeError("DATOS_INVALIDOS"), camposConError);
  }

  try {
    return exito(await operacion(validacion.data));
  } catch (error) {
    return traducirError(error);
  }
}

export function traducirError<T>(error: unknown): Resultado<T> {
  if (esErrorDeDominio(error)) {
    const camposConError = error.campo ? { [error.campo]: [error.message] } : undefined;
    return fallo(error.codigo, mensajeDeError(error.codigo, error.message), camposConError);
  }

  // Errores de PostgREST/Postgres: se detectan los codigos de nuestras
  // restricciones y triggers para dar un mensaje util (§6.3, §6.6).
  const mensaje = error instanceof Error ? error.message : String(error);
  const codigoConocido = [
    "PROYECTO_CERRADO",
    "CATEGORIA_INCOMPATIBLE",
    "CATEGORIA_NO_ENCONTRADA",
    "MONEDA_INCOMPATIBLE",
    "PROYECTO_NO_ENCONTRADO",
    "FILA_DE_SISTEMA_NO_MODIFICABLE",
    "FILA_DE_SISTEMA_NO_ELIMINABLE",
  ].find((codigo) => mensaje.includes(codigo));

  if (codigoConocido) {
    return fallo(codigoConocido, mensajeDeError(codigoConocido));
  }
  if (mensaje.includes("duplicate key")) {
    return fallo("DUPLICADO", "Ya existe un registro con esos datos.");
  }

  // Detalle solo en el servidor; al usuario un mensaje generico (§8.6).
  console.error("[accion] error inesperado:", error);
  return fallo("ERROR_INESPERADO", mensajeDeError("ERROR_INESPERADO"));
}
