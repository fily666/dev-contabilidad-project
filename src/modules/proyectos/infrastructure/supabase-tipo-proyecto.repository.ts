import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/database.types";
import { TipoProyecto } from "../domain/tipo-proyecto.entity";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";
import { aFilaTipoProyecto, aTipoProyecto } from "./proyecto.mapper";

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

  /** RF-100: el gestor de configuracion necesita ver tambien los ocultos. */
  async listarTodos(): Promise<TipoProyecto[]> {
    const { data, error } = await this.supabase
      .from("tipos_proyecto")
      .select("*")
      .order("es_sistema", { ascending: false })
      .order("nombre");

    if (error) throw error;
    return (data ?? []).map(aTipoProyecto);
  }

  async guardar(tipo: TipoProyecto): Promise<TipoProyecto> {
    const fila = aFilaTipoProyecto(tipo);
    // `es_sistema` no es insertable a proposito (§6.3): la columna nace en false
    // y el trigger de §6.6 impide promover una fila propia a fila del sistema.
    const { data, error } = await this.supabase
      .from("tipos_proyecto")
      .insert({
        id: fila.id,
        codigo: fila.codigo,
        nombre: fila.nombre,
        icono: fila.icono,
        configuracion: fila.configuracion,
        activo: fila.activo,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aTipoProyecto(data);
  }

  async actualizar(tipo: TipoProyecto): Promise<TipoProyecto> {
    const fila = aFilaTipoProyecto(tipo);
    const { data, error } = await this.supabase
      .from("tipos_proyecto")
      .update({
        nombre: fila.nombre,
        icono: fila.icono,
        configuracion: fila.configuracion,
        activo: fila.activo,
      })
      .eq("id", tipo.id)
      .select("*")
      .single();

    if (error) throw error;
    return aTipoProyecto(data);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from("tipos_proyecto").delete().eq("id", id);
    if (error) throw error;
  }

  async contarProyectos(tipoProyectoId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("proyectos")
      .select("id", { count: "exact", head: true })
      .eq("tipo_proyecto_id", tipoProyectoId);

    if (error) throw error;
    return count ?? 0;
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
