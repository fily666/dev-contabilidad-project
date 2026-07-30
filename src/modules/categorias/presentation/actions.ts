"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaActualizarCategoria,
  esquemaCambiarEstadoCategoria,
  esquemaCrearCategoria,
  esquemaEliminarCategoria,
} from "./schemas";

function revalidar() {
  revalidatePath("/configuracion");
  revalidatePath("/movimientos");
}

/** RF-31. */
export async function crearCategoriaAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCrearCategoria, datos, async (entrada) => {
    const categoria = await contenedor.categorias.crear.ejecutar({
      ...entrada,
    });
    revalidar();
    return { id: categoria.id };
  });
}

/** RF-31. */
export async function actualizarCategoriaAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarCategoria, datos, async (entrada) => {
    const categoria = await contenedor.categorias.actualizar.ejecutar({
      ...entrada,
    });
    revalidar();
    return { id: categoria.id };
  });
}

/** RF-31, RF-34. */
export async function cambiarEstadoCategoriaAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCambiarEstadoCategoria, datos, async (entrada) => {
    const categoria = await contenedor.categorias.cambiarEstado.ejecutar({
      ...entrada,
    });
    revalidar();
    return { id: categoria.id };
  });
}

/** RF-34. */
export async function eliminarCategoriaAction(datos: unknown): Promise<Resultado<null>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarCategoria, datos, async (entrada) => {
    await contenedor.categorias.eliminar.ejecutar({
      id: entrada.id,
    });
    revalidar();
    return null;
  });
}
