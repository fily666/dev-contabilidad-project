"use server";

import { revalidatePath } from "next/cache";
import { contenedorAutenticado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaActualizarMovimiento,
  esquemaAnularMovimiento,
  esquemaMarcarPagado,
  esquemaRegistrarMovimiento,
} from "./schemas";

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
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaRegistrarMovimiento, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.registrar.ejecutar({
      propietarioId: sesion.usuarioId,
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
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaActualizarMovimiento, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.actualizar.ejecutar({
      propietarioId: sesion.usuarioId,
      ...entrada,
    });
    revalidar(movimiento.proyectoId);
    return { id: movimiento.id };
  });
}

/** RF-26. */
export async function marcarPagadoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaMarcarPagado, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.marcarPagado.ejecutar({
      propietarioId: sesion.usuarioId,
      ...entrada,
    });
    revalidar(movimiento.proyectoId);
    return { id: movimiento.id };
  });
}

/** RF-22: anular conserva el registro y lo excluye de las cifras. */
export async function anularMovimientoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaAnularMovimiento, datos, async (entrada) => {
    const movimiento = await contenedor.movimientos.anular.ejecutar({
      propietarioId: sesion.usuarioId,
      ...entrada,
    });
    revalidar(movimiento.proyectoId);
    return { id: movimiento.id };
  });
}
