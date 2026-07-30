"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaActualizarProyecto,
  esquemaCambiarEstadoProyecto,
  esquemaCrearProyecto,
  esquemaEliminarProyecto,
} from "./schemas";

function revalidar(proyectoId?: string) {
  revalidatePath("/proyectos");
  revalidatePath("/dashboard");
  if (proyectoId) revalidatePath(`/proyectos/${proyectoId}`);
}

/** RF-10, RF-11, RF-12, RF-14. */
export async function crearProyectoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCrearProyecto, datos, async (entrada) => {
    const proyecto = await contenedor.proyectos.crear.ejecutar({
      ...entrada,
    });
    revalidar(proyecto.id);
    return { id: proyecto.id };
  });
}

/** RF-10, RF-12, RF-14. */
export async function actualizarProyectoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarProyecto, datos, async (entrada) => {
    const proyecto = await contenedor.proyectos.actualizar.ejecutar({
      ...entrada,
    });
    revalidar(proyecto.id);
    return { id: proyecto.id };
  });
}

/** RF-13. */
export async function cambiarEstadoProyectoAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCambiarEstadoProyecto, datos, async (entrada) => {
    const proyecto = await contenedor.proyectos.cambiarEstado.ejecutar({
      ...entrada,
    });
    revalidar(proyecto.id);
    return { id: proyecto.id };
  });
}

/** RF-18. */
export async function eliminarProyectoAction(datos: unknown): Promise<Resultado<null>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarProyecto, datos, async (entrada) => {
    await contenedor.proyectos.eliminar.ejecutar({
      id: entrada.id,
    });
    revalidar();
    return null;
  });
}
