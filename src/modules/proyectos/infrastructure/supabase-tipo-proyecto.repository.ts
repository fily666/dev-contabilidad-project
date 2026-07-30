import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/database.types";
import type { TipoProyecto } from "../domain/tipo-proyecto.entity";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";
import { aTipoProyecto } from "./proyecto.mapper";

/** ADAPTADOR del puerto TipoProyectoRepository (Contexto.md §7.3). */
export class SupabaseTipoProyectoRepository implements TipoProyectoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(): Promise<TipoProyecto[]> {
    // RLS ya limita la lectura a los del sistema mas los propios; el filtro
    // explicito documenta la intencion y evita depender solo de la politica.
    const { data, error } = await this.supabase
      .from("tipos_proyecto")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) throw error;
    return (data ?? []).map(aTipoProyecto);
  }

  async buscarPorId(id: string): Promise<TipoProyecto | null> {
    const { data, error } = await this.supabase
      .from("tipos_proyecto")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aTipoProyecto(data) : null;
  }

  async buscarPorCodigo(codigo: string): Promise<TipoProyecto | null> {
    const { data, error } = await this.supabase
      .from("tipos_proyecto")
      .select("*")
      .eq("codigo", codigo)
      .order("es_sistema", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? aTipoProyecto(data) : null;
  }
}
