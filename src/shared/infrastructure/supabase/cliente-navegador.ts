"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { claveAnonima, urlSupabase } from "./entorno";

/**
 * Cliente para componentes de cliente (Contexto.md §9).
 * Usa la clave anonima; el aislamiento lo garantiza RLS.
 */
export function crearClienteNavegador() {
  return createBrowserClient<Database>(urlSupabase(), claveAnonima());
}
