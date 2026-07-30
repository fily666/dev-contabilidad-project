import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { claveServicio, urlSupabase } from "./entorno";

/**
 * Cliente unico de acceso a datos (Contexto.md §9, ADR-15).
 *
 * Se conecta con service_role, que pasa por encima de RLS. En un sistema
 * monousuario eso no es un atajo: no hay filas de otro a las que aislarse, y la
 * base esta cerrada a los roles publicos precisamente para que esta sea la unica
 * puerta (migracion 20260730120300).
 *
 * El `import "server-only"` de arriba es la barrera que importa: si algun dia un
 * componente con "use client" importa este modulo, la compilacion falla en vez de
 * enviar la clave al navegador.
 */
export function crearClienteServidor() {
  return createClient<Database>(urlSupabase(), claveServicio(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
