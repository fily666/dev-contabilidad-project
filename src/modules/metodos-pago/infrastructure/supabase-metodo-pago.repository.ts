import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import type { TipoMetodoPago } from "@/shared/domain/enumeraciones";
import { MetodoPago } from "../domain/metodo-pago.entity";
import type { MetodoPagoRepository, MetodoPagoVista } from "../domain/metodo-pago.repository";

function aVista(fila: Tablas<"metodos_pago">): MetodoPagoVista {
  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo as TipoMetodoPago,
    ultimosDigitos: fila.ultimos_digitos,
    activo: fila.activo,
  };
}

function aEntidad(fila: Tablas<"metodos_pago">): MetodoPago {
  return MetodoPago.desdePersistencia(aVista(fila));
}

/** ADAPTADOR del puerto MetodoPagoRepository (Contexto.md §7.3). */
export class SupabaseMetodoPagoRepository implements MetodoPagoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(soloActivos = true): Promise<MetodoPagoVista[]> {
    let consulta = this.supabase.from("metodos_pago").select("*");

    if (soloActivos) consulta = consulta.eq("activo", true);

    const { data, error } = await consulta.order("nombre");
    if (error) throw error;
    return (data ?? []).map(aVista);
  }

  async buscarPorId(id: string): Promise<MetodoPago | null> {
    const { data, error } = await this.supabase
      .from("metodos_pago")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aEntidad(data) : null;
  }

  /**
   * `ilike` sin comodines compara sin distinguir mayusculas: «Efectivo» y
   * «efectivo» son el mismo metodo para quien lo lee, aunque el unique de la
   * tabla los admitiria como dos filas distintas.
   */
  async existeNombre(nombre: string, excluirId?: string): Promise<boolean> {
    let consulta = this.supabase
      .from("metodos_pago")
      .select("id", { count: "exact", head: true })
      .ilike("nombre", nombre.trim());

    if (excluirId) consulta = consulta.neq("id", excluirId);

    const { count, error } = await consulta;
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async guardar(metodo: MetodoPago): Promise<MetodoPagoVista> {
    const { data, error } = await this.supabase
      .from("metodos_pago")
      .insert({
        id: metodo.id,
        nombre: metodo.nombre,
        tipo: metodo.tipo,
        ultimos_digitos: metodo.ultimosDigitos,
        activo: metodo.activo,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aVista(data);
  }

  async actualizar(metodo: MetodoPago): Promise<MetodoPagoVista> {
    const { data, error } = await this.supabase
      .from("metodos_pago")
      .update({
        nombre: metodo.nombre,
        tipo: metodo.tipo,
        ultimos_digitos: metodo.ultimosDigitos,
        activo: metodo.activo,
      })
      .eq("id", metodo.id)
      .select("*")
      .single();

    if (error) throw error;
    return aVista(data);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from("metodos_pago").delete().eq("id", id);

    if (error) throw error;
  }

  async contarMovimientos(id: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("movimientos")
      .select("id", { count: "exact", head: true })
      .eq("metodo_pago_id", id);

    if (error) throw error;
    return count ?? 0;
  }
}
