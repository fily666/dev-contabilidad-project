import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { claveServicio, urlSupabase } from "./entorno";

/**
 * Cliente administrativo (service_role): OMITE RLS.
 *
 * Contexto.md §9: uso exclusivo de las tareas programadas en /api/cron.
 * ESLint bloquea su importacion desde cualquier otro punto de src/app.
 */
export function crearClienteAdmin() {
  return createClient<Database>(urlSupabase(), claveServicio(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
