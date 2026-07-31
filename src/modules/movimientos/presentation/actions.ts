"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaActualizarMovimiento,
  esquemaAnularMovimiento,
  esquemaDuplicarMovimiento,
  esquemaImportacionCsv,
  esquemaMarcarPagado,
  esquemaRegistrarMovimiento,
} from "./schemas";
import type { Previsualizacion } from "../application/importar-movimientos.use-case";

function revalidar(proyectoId?: string) {
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/proyectos");
  if (proyectoId) {
    revalidatePath(`/proyectos/${proyectoId}`);
    revalidatePath(`/proyectos/${proyectoId}/movimientos`);
  }
}

/** RF-20, RF-21, RF-26. */
export async function registrarMovimientoAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaRegistrarMovimiento, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.registrar.ejecutar({
      ...entrada,
    });
    revalidar(movimiento.proyectoId);
    return { id: movimiento.id };
  });
}

/** RF-22. */
export async function actualizarMovimientoAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarMovimiento, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.actualizar.ejecutar({
      ...entrada,
    });
    revalidar(movimiento.proyectoId);
    return { id: movimiento.id };
  });
}

/** RF-26. */
export async function marcarPagadoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaMarcarPagado, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.marcarPagado.ejecutar({
      ...entrada,
    });
    revalidar(movimiento.proyectoId);
    return { id: movimiento.id };
  });
}

/** RF-22: anular conserva el registro y lo excluye de las cifras. */
export async function anularMovimientoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaAnularMovimiento, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.anular.ejecutar({
      ...entrada,
    });
    revalidar(movimiento.proyectoId);
    return { id: movimiento.id };
  });
}

/** RF-28: la copia nace pendiente y con la fecha de hoy. */
export async function duplicarMovimientoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaDuplicarMovimiento, datos, async (entrada) => {
    const copia = await contenedor.movimientos.duplicar.ejecutar({
      id: entrada.id,
      fecha: entrada.fecha ?? undefined,
    });
    revalidar(copia.proyectoId);
    return { id: copia.id };
  });
}

/** RF-27: previsualización. No escribe nada en la base. */
export async function previsualizarImportacionAction(
  datos: unknown,
): Promise<Resultado<Previsualizacion>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaImportacionCsv, datos, async (entrada) =>
    contenedor.movimientos.previsualizarImportacion.ejecutar(entrada),
  );
}

/** RF-27: importa solo las filas válidas de la previsualización. */
export async function importarMovimientosAction(datos: unknown): Promise<
  Resultado<{
    importados: number;
    omitidos: number;
    fallidos: Array<{ numero: number; motivo: string }>;
  }>
> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaImportacionCsv, datos, async (entrada) => {
    const resultado = await contenedor.movimientos.importar.ejecutar(entrada);
    revalidar(entrada.proyectoId);
    return resultado;
  });
}
