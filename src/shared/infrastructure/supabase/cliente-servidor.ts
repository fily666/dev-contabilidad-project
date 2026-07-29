import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { claveAnonima, urlSupabase } from "./entorno";

/**
 * Cliente por request para Server Components, Server Actions y Route Handlers.
 * Contexto.md §9: clave anonima + sesion del usuario en cookies HTTP-only.
 */
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient<Database>(urlSupabase(), claveAnonima(), {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesPorEscribir) {
        try {
          for (const { name, value, options } of cookiesPorEscribir) {
            almacen.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies: el refresco de
          // sesion lo hace el middleware. Ignorar aqui es el comportamiento
          // esperado por @supabase/ssr.
        }
      },
    },
  });
}
