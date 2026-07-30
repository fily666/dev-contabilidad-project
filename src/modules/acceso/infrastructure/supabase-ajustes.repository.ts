import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/infrastructure/supabase/database.types";
import { AJUSTES_POR_OMISION, type Ajustes, type AjustesRepository } from "../domain/sesion";

/** ADAPTADOR del puerto AjustesRepository (Contexto.md §7.3). */
export class SupabaseAjustesRepository implements AjustesRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async obtener(): Promise<Ajustes> {
    const { data, error } = await this.supabase
      .from("ajustes")
      .select("moneda, zona_horaria")
      .maybeSingle();

    if (error) throw error;

    // Si seed.sql no ha corrido todavia, la aplicacion arranca con los valores
    // por omision en lugar de reventar: son los mismos que siembra la semilla.
    if (!data) return AJUSTES_POR_OMISION;

    return { moneda: data.moneda, zonaHoraria: data.zona_horaria };
  }

  async actualizar(datos: Partial<Ajustes>): Promise<Ajustes> {
    const { data, error } = await this.supabase
      .from("ajustes")
      .upsert({
        id: true,
        ...(datos.moneda === undefined ? {} : { moneda: datos.moneda }),
        ...(datos.zonaHoraria === undefined ? {} : { zona_horaria: datos.zonaHoraria }),
      })
      .select("moneda, zona_horaria")
      .single();

    if (error) throw error;
    return { moneda: data.moneda, zonaHoraria: data.zona_horaria };
  }
}
