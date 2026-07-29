"use server";

import { revalidatePath } from "next/cache";
import { contenedorAutenticado } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Resultado } from "@/shared/domain/resultado";
import type { MetodoPago } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import {
  esquemaActualizarCategoria,
  esquemaActualizarMetodoPago,
  esquemaCambiarEstadoCategoria,
  esquemaCrearCategoria,
  esquemaEliminarCategoria,
  esquemaEliminarMetodoPago,
  esquemaMetodoPago,
} from "./schemas";

function revalidar() {
  revalidatePath("/configuracion");
  revalidatePath("/movimientos");
}

/** RF-31. */
export async function crearCategoriaAction(datos: unknown): Promise<Resultado<{ id: string }>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaCrearCategoria, datos, async (entrada) => {
    const categoria = await contenedor.categorias.crear.ejecutar({
      propietarioId: sesion.usuarioId,
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
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaActualizarCategoria, datos, async (entrada) => {
    const categoria = await contenedor.categorias.actualizar.ejecutar({
      propietarioId: sesion.usuarioId,
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
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaCambiarEstadoCategoria, datos, async (entrada) => {
    const categoria = await contenedor.categorias.cambiarEstado.ejecutar({
      propietarioId: sesion.usuarioId,
      ...entrada,
    });
    revalidar();
    return { id: categoria.id };
  });
}

/** RF-34. */
export async function eliminarCategoriaAction(datos: unknown): Promise<Resultado<null>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaEliminarCategoria, datos, async (entrada) => {
    await contenedor.categorias.eliminar.ejecutar({
      id: entrada.id,
      propietarioId: sesion.usuarioId,
    });
    revalidar();
    return null;
  });
}

/** RF-33. */
export async function crearMetodoPagoAction(datos: unknown): Promise<Resultado<MetodoPago>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaMetodoPago, datos, async (entrada) => {
    const metodo = await contenedor.metodosPago.crear(sesion.usuarioId, entrada);
    revalidar();
    return metodo;
  });
}

/** RF-33. */
export async function actualizarMetodoPagoAction(datos: unknown): Promise<Resultado<MetodoPago>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaActualizarMetodoPago, datos, async ({ id, ...entrada }) => {
    const metodo = await contenedor.metodosPago.actualizar(id, sesion.usuarioId, entrada);
    revalidar();
    return metodo;
  });
}

/** RF-33: no se elimina un metodo de pago en uso. */
export async function eliminarMetodoPagoAction(datos: unknown): Promise<Resultado<null>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaEliminarMetodoPago, datos, async (entrada) => {
    const enUso = await contenedor.metodosPago.contarMovimientos(entrada.id, sesion.usuarioId);
    if (enUso > 0) {
      throw new ReglaDeNegocioViolada(
        "METODO_PAGO_EN_USO",
        `El método de pago tiene ${enUso} movimiento(s) asociado(s): desactívalo en lugar de eliminarlo.`,
      );
    }
    await contenedor.metodosPago.eliminar(entrada.id, sesion.usuarioId);
    revalidar();
    return null;
  });
}
