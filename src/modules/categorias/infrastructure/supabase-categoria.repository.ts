import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Categoria } from "../domain/categoria.entity";
import type {
  CategoriaConRuta,
  CategoriaRepository,
  FiltroCategorias,
} from "../domain/categoria.repository";

type Fila = Tablas<"categorias">;

function aCategoria(fila: Fila): Categoria {
  return Categoria.desdePersistencia({
    id: fila.id,
    tipoProyectoId: fila.tipo_proyecto_id,
    padreId: fila.padre_id,
    nombre: fila.nombre,
    naturaleza: fila.naturaleza,
    esSistema: fila.es_sistema,
    activa: fila.activa,
    orden: fila.orden,
  });
}

/** ADAPTADOR del puerto CategoriaRepository (Contexto.md §7.3). */
export class SupabaseCategoriaRepository implements CategoriaRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string): Promise<Categoria | null> {
    const { data, error } = await this.supabase
      .from("categorias")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aCategoria(data) : null;
  }

  async listar(filtro?: FiltroCategorias): Promise<CategoriaConRuta[]> {
    let consulta = this.supabase.from("categorias").select("*");

    if (filtro?.tipoProyectoId !== undefined && filtro.tipoProyectoId !== null) {
      // Transversales (sin tipo) + las del tipo solicitado.
      consulta = consulta.or(
        `tipo_proyecto_id.is.null,tipo_proyecto_id.eq.${filtro.tipoProyectoId}`,
      );
    }
    if (filtro?.naturalezas?.length) {
      consulta = consulta.in("naturaleza", filtro.naturalezas);
    }
    if (filtro?.soloActivas !== false) {
      consulta = consulta.eq("activa", true);
    }

    const { data, error } = await consulta.order("orden").order("nombre");
    if (error) throw error;

    const filas = data ?? [];
    const nombrePorId = new Map(filas.map((f) => [f.id, f.nombre]));

    return filas.map((f) => {
      const padreNombre = f.padre_id ? (nombrePorId.get(f.padre_id) ?? null) : null;
      return {
        id: f.id,
        nombre: f.nombre,
        ruta: padreNombre ? `${padreNombre} › ${f.nombre}` : f.nombre,
        padreId: f.padre_id,
        padreNombre,
        naturaleza: f.naturaleza,
        esSistema: f.es_sistema,
        activa: f.activa,
        esRaiz: f.padre_id === null,
        tipoProyectoId: f.tipo_proyecto_id,
      };
    });
  }

  async guardar(categoria: Categoria): Promise<Categoria> {
    const d = categoria.aDatos();
    const { data, error } = await this.supabase
      .from("categorias")
      .insert({
        id: d.id,
        tipo_proyecto_id: d.tipoProyectoId,
        padre_id: d.padreId,
        nombre: d.nombre,
        naturaleza: d.naturaleza,
        // es_sistema no se envia: la columna nace en false y el tipo generado lo
        // excluye a proposito para que solo seed.sql cree filas del sistema.
        activa: d.activa,
        orden: d.orden,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aCategoria(data);
  }

  async actualizar(categoria: Categoria): Promise<Categoria> {
    const d = categoria.aDatos();
    const { data, error } = await this.supabase
      .from("categorias")
      .update({
        nombre: d.nombre,
        naturaleza: d.naturaleza,
        activa: d.activa,
        orden: d.orden,
      })
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) throw error;
    return aCategoria(data);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from("categorias").delete().eq("id", id);

    if (error) throw error;
  }

  async contarMovimientos(categoriaId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("movimientos")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", categoriaId);

    if (error) throw error;
    return count ?? 0;
  }

  async existeNombre(
    nombre: string,
    tipoProyectoId: string | null,
    padreId: string | null,
    excluirId?: string,
  ): Promise<boolean> {
    let consulta = this.supabase
      .from("categorias")
      .select("id", { count: "exact", head: true })
      .ilike("nombre", nombre);

    consulta = tipoProyectoId
      ? consulta.eq("tipo_proyecto_id", tipoProyectoId)
      : consulta.is("tipo_proyecto_id", null);
    consulta = padreId ? consulta.eq("padre_id", padreId) : consulta.is("padre_id", null);
    if (excluirId) consulta = consulta.neq("id", excluirId);

    const { count, error } = await consulta;
    if (error) throw error;
    return (count ?? 0) > 0;
  }
}
