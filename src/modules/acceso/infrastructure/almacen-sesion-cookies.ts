import { cookies } from "next/headers";

import type { AlmacenSesion } from "../domain/sesion";

/** ADAPTADOR de AlmacenSesion sobre las cookies del request (§9). */

export const NOMBRE_COOKIE_SESION = "gf_sesion";

export async function crearAlmacenSesion(): Promise<AlmacenSesion> {
  const almacen = await cookies();

  return {
    async leer() {
      return almacen.get(NOMBRE_COOKIE_SESION)?.value ?? null;
    },

    async escribir(valor, duracionSegundos) {
      almacen.set(NOMBRE_COOKIE_SESION, valor, {
        httpOnly: true, // invisible para JavaScript del navegador
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: duracionSegundos,
      });
    },

    async borrar() {
      almacen.delete(NOMBRE_COOKIE_SESION);
    },
  };
}
