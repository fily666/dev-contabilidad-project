"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contenedorAutenticado, crearContenedor } from "@/di/container";
import { ejecutarAccion } from "@/shared/presentation/ejecutar-accion";
import type { Resultado } from "@/shared/domain/resultado";
import type { Perfil } from "../domain/sesion";
import {
  esquemaActualizarClave,
  esquemaIniciarSesion,
  esquemaPerfil,
  esquemaRecuperarClave,
  esquemaRegistro,
} from "./schemas";

/** RF-01. */
export async function iniciarSesionAction(datos: unknown): Promise<Resultado<null>> {
  const contenedor = await crearContenedor();
  return ejecutarAccion(esquemaIniciarSesion, datos, async (entrada) => {
    await contenedor.autenticacion.iniciarSesion(entrada);
    revalidatePath("/", "layout");
    return null;
  });
}

/** RF-01. */
export async function registrarAction(
  datos: unknown,
): Promise<Resultado<{ requiereConfirmacion: boolean }>> {
  const contenedor = await crearContenedor();
  return ejecutarAccion(esquemaRegistro, datos, async (entrada) => {
    const resultado = await contenedor.autenticacion.registrar({
      correo: entrada.correo,
      clave: entrada.clave,
      nombreCompleto: entrada.nombreCompleto,
    });
    revalidatePath("/", "layout");
    return resultado;
  });
}

/** RF-02. */
export async function recuperarClaveAction(datos: unknown): Promise<Resultado<null>> {
  const contenedor = await crearContenedor();
  return ejecutarAccion(esquemaRecuperarClave, datos, async (entrada) => {
    await contenedor.autenticacion.enviarCorreoRecuperacion(entrada.correo);
    return null;
  });
}

/** RF-02. */
export async function actualizarClaveAction(datos: unknown): Promise<Resultado<null>> {
  const contenedor = await crearContenedor();
  return ejecutarAccion(esquemaActualizarClave, datos, async (entrada) => {
    await contenedor.autenticacion.actualizarClave(entrada.clave);
    revalidatePath("/", "layout");
    return null;
  });
}

/** RF-04. */
export async function cerrarSesionAction(): Promise<void> {
  const contenedor = await crearContenedor();
  await contenedor.autenticacion.cerrarSesion();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** RF-03. */
export async function actualizarPerfilAction(datos: unknown): Promise<Resultado<Perfil>> {
  const { contenedor, sesion } = await contenedorAutenticado();
  return ejecutarAccion(esquemaPerfil, datos, async (entrada) => {
    const perfil = await contenedor.perfiles.actualizar(sesion.usuarioId, entrada);
    revalidatePath("/perfil");
    revalidatePath("/", "layout");
    return perfil;
  });
}
