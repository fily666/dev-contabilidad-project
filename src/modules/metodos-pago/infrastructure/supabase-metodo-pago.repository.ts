import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import type { TipoMetodoPago } from "@/shared/domain/enumeraciones";
import type {
  EntradaMetodoPago,
  MetodoPago,
  MetodoPagoRepository,
} from "../domain/metodo-pago.repository";

function aMetodo(fila: Tablas<"metodos_pago">): MetodoPago {
  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo as TipoMetodoPago,
    ultimosDigitos: fila.ultimos_digitos,
    activo: fila.activo,
  };
}

/** ADAPTADOR del puerto MetodoPagoRepository (Contexto.md §7.3). */
export class SupabaseMetodoPagoRepository implements MetodoPagoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listar(soloActivos = true): Promise<MetodoPago[]> {
    let consulta = this.supabase.from("metodos_pago").select("*");

    if (soloActivos) consulta = consulta.eq("activo", true);

    const { data, error } = await consulta.order("nombre");
    if (error) throw error;
    return (data ?? []).map(aMetodo);
  }

  async buscarPorId(id: string): Promise<MetodoPago | null> {
    const { data, error } = await this.supabase
      .from("metodos_pago")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aMetodo(data) : null;
  }

  async crear(entrada: EntradaMetodoPago): Promise<MetodoPago> {
    const { data, error } = await this.supabase
      .from("metodos_pago")
      .insert({
        nombre: entrada.nombre.trim(),
        tipo: entrada.tipo,
        ultimos_digitos: entrada.ultimosDigitos?.trim() || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aMetodo(data);
  }

  async actualizar(
    id: string,
    entrada: EntradaMetodoPago & { activo?: boolean },
  ): Promise<MetodoPago> {
    const { data, error } = await this.supabase
      .from("metodos_pago")
      .update({
        nombre: entrada.nombre.trim(),
        tipo: entrada.tipo,
        ultimos_digitos: entrada.ultimosDigitos?.trim() || null,
        ...(entrada.activo === undefined ? {} : { activo: entrada.activo }),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return aMetodo(data);
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
