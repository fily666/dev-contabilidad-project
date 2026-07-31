"use server";

import { revalidatePath } from "next/cache";
import { contenedorPrivado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import {
  esquemaActualizarProyecto,
  esquemaActualizarTipoProyecto,
  esquemaCambiarEstadoProyecto,
  esquemaCambiarEstadoTipoProyecto,
  esquemaCrearProyecto,
  esquemaCrearTipoProyecto,
  esquemaEliminarProyecto,
  esquemaEliminarTipoProyecto,
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

/** RF-100: la configuracion del tipo se arma desde el formulario plano. */
function configuracionDesde(entrada: {
  atributos: Array<{ clave: string; etiqueta: string; tipo: string; requerido: boolean }>;
  indicadores: string[];
  generaIngresos: boolean;
  seValoriza: boolean;
}) {
  return {
    atributos: entrada.atributos.map((a) => ({
      clave: a.clave,
      etiqueta: a.etiqueta,
      tipo: a.tipo as "text" | "number" | "date" | "boolean",
      requerido: a.requerido,
    })),
    indicadores: entrada.indicadores,
    generaIngresos: entrada.generaIngresos,
    seValoriza: entrada.seValoriza,
  };
}

function revalidarCatalogos() {
  revalidatePath("/configuracion");
  revalidatePath("/proyectos/nuevo");
  revalidatePath("/proyectos");
}

/** RF-100. */
export async function crearTipoProyectoAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCrearTipoProyecto, datos, async (entrada) => {
    const tipo = await contenedor.proyectos.crearTipo.ejecutar({
      codigo: entrada.codigo,
      nombre: entrada.nombre,
      icono: entrada.icono,
      configuracion: configuracionDesde(entrada),
    });
    revalidarCatalogos();
    return { id: tipo.id };
  });
}

/** RF-100. */
export async function actualizarTipoProyectoAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaActualizarTipoProyecto, datos, async (entrada) => {
    const tipo = await contenedor.proyectos.actualizarTipo.ejecutar({
      id: entrada.id,
      nombre: entrada.nombre,
      icono: entrada.icono,
      configuracion: configuracionDesde(entrada),
    });
    revalidarCatalogos();
    return { id: tipo.id };
  });
}

/** RF-100, RF-34: ocultar o reactivar. */
export async function cambiarEstadoTipoProyectoAction(
  datos: unknown,
): Promise<Resultado<{ id: string; activo: boolean }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaCambiarEstadoTipoProyecto, datos, async (entrada) => {
    const tipo = await contenedor.proyectos.cambiarEstadoTipo.ejecutar(entrada);
    revalidarCatalogos();
    return { id: tipo.id, activo: tipo.activo };
  });
}

/** RF-100. */
export async function eliminarTipoProyectoAction(
  datos: unknown,
): Promise<Resultado<{ id: string }>> {
  const { contenedor } = await contenedorPrivado();
  return ejecutarAccion(esquemaEliminarTipoProyecto, datos, async (entrada) => {
    await contenedor.proyectos.eliminarTipo.ejecutar(entrada);
    revalidarCatalogos();
    return { id: entrada.id };
  });
}
