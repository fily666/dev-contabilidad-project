import { NextResponse, type NextRequest } from "next/server";

import { verificarSesion } from "@/modules/acceso/domain/sesion-firmada";
import { NOMBRE_COOKIE_SESION } from "@/modules/acceso/infrastructure/almacen-sesion-cookies";
import { credencialDelEntorno } from "@/modules/acceso/infrastructure/credencial-entorno";

const RUTAS_PUBLICAS = ["/acceso"];

/**
 * Protege las rutas privadas verificando la cookie de sesion firmada.
 * Contexto.md §9 y criterio de aceptacion de RF-04.
 *
 * Corre en el runtime Edge, asi que no puede usar `node:crypto` ni hablar con la
 * base. Solo necesita HMAC sobre la cookie, que es exactamente lo que hace
 * `verificarSesion` con Web Crypto: la misma funcion que usa el servidor.
 */
export async function middleware(request: NextRequest) {
  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

  const cookie = request.cookies.get(NOMBRE_COOKIE_SESION)?.value ?? null;

  let haySesion = false;
  if (cookie) {
    const credencial = credencialDelEntorno();
    haySesion = await verificarSesion(
      credencial.secretoSesion(),
      credencial.token(),
      cookie,
      Math.floor(Date.now() / 1000),
    );
  }

  if (!haySesion && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/acceso";
    destino.searchParams.set("siguiente", ruta);
    return NextResponse.redirect(destino);
  }

  if (haySesion && esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/dashboard";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
