import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Presupuesto } from "../domain/presupuesto.entity";
import type {
  EjecucionPresupuesto,
  FiltroPresupuestos,
  PresupuestoRepository,
} from "../domain/presupuesto.repository";

type Fila = Tablas<"presupuestos">;

function aPresupuesto(fila: Fila): Presupuesto {
  return Presupuesto.desdePersistencia({
    id: fila.id,
    proyectoId: fila.proyecto_id,
    categoriaId: fila.categoria_id,
    periodoInicio: fila.periodo_inicio,
    periodoFin: fila.periodo_fin,
    valorPlaneado: Number(fila.valor_planeado),
    notas: fila.notas,
  });
}

/** ADAPTADOR del puerto PresupuestoRepository (Contexto.md §7.3). */
export class SupabasePresupuestoRepository implements PresupuestoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string): Promise<Presupuesto | null> {
    const { data, error } = await this.supabase
      .from("presupuestos")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aPresupuesto(data) : null;
  }

  /** RF-81: la vista de §6.4 ya trae real, desviacion y ejecucion. */
  async listarEjecucion(filtro: FiltroPresupuestos = {}): Promise<EjecucionPresupuesto[]> {
    let consulta = this.supabase
      .from("v_presupuesto_ejecucion")
      .select("*")
      .order("periodo_inicio", { ascending: false });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    // Interseccion de rangos: el periodo empieza antes de que acabe la ventana y
    // termina despues de que empiece.
    if (filtro.hasta) consulta = consulta.lte("periodo_inicio", filtro.hasta);
    if (filtro.desde) consulta = consulta.gte("periodo_fin", filtro.desde);
    if (filtro.vigenteEn) {
      consulta = consulta
        .lte("periodo_inicio", filtro.vigenteEn)
        .gte("periodo_fin", filtro.vigenteEn);
    }

    const { data, error } = await consulta;
    if (error) throw error;

    // La moneda es la del proyecto, o la de los ajustes en los globales (§17).
    const { data: ajustes } = await this.supabase.from("ajustes").select("moneda").maybeSingle();
    const monedaGlobal = ajustes?.moneda ?? "COP";

    const proyectoIds = [
      ...new Set((data ?? []).map((f) => f.proyecto_id).filter((id): id is string => !!id)),
    ];
    const monedaPorProyecto = new Map<string, string>();
    if (proyectoIds.length > 0) {
      const { data: proyectos, error: errorProyectos } = await this.supabase
        .from("proyectos")
        .select("id, moneda")
        .in("id", proyectoIds);
      if (errorProyectos) throw errorProyectos;
      for (const proyecto of proyectos ?? []) monedaPorProyecto.set(proyecto.id, proyecto.moneda);
    }

    return (data ?? []).map((f) => ({
      presupuestoId: f.presupuesto_id,
      proyectoId: f.proyecto_id,
      proyecto: f.proyecto,
      categoriaId: f.categoria_id,
      categoria: f.categoria,
      naturaleza: f.naturaleza,
      periodoInicio: f.periodo_inicio,
      periodoFin: f.periodo_fin,
      valorPlaneado: Number(f.valor_planeado),
      valorReal: Number(f.valor_real),
      desviacion: Number(f.desviacion),
      ejecucion: f.ejecucion === null ? null : Number(f.ejecucion),
      movimientos: Number(f.movimientos),
      moneda: f.proyecto_id ? (monedaPorProyecto.get(f.proyecto_id) ?? monedaGlobal) : monedaGlobal,
    }));
  }

  async guardar(presupuesto: Presupuesto): Promise<Presupuesto> {
    const d = presupuesto.aDatos();
    const { data, error } = await this.supabase
      .from("presupuestos")
      .insert({
        id: d.id,
        proyecto_id: d.proyectoId,
        categoria_id: d.categoriaId,
        periodo_inicio: d.periodoInicio,
        periodo_fin: d.periodoFin,
        valor_planeado: d.valorPlaneado,
        notas: d.notas,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aPresupuesto(data);
  }

  async actualizar(presupuesto: Presupuesto): Promise<Presupuesto> {
    const d = presupuesto.aDatos();
    const { data, error } = await this.supabase
      .from("presupuestos")
      .update({
        categoria_id: d.categoriaId,
        periodo_inicio: d.periodoInicio,
        periodo_fin: d.periodoFin,
        valor_planeado: d.valorPlaneado,
        notas: d.notas,
      })
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) throw error;
    return aPresupuesto(data);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from("presupuestos").delete().eq("id", id);
    if (error) throw error;
  }

  async listarDePeriodo(entrada: {
    proyectoId?: string | null;
    periodoInicio: string;
    periodoFin: string;
  }): Promise<Presupuesto[]> {
    let consulta = this.supabase
      .from("presupuestos")
      .select("*")
      .eq("periodo_inicio", entrada.periodoInicio)
      .eq("periodo_fin", entrada.periodoFin);

    consulta =
      entrada.proyectoId === null || entrada.proyectoId === undefined
        ? consulta.is("proyecto_id", null)
        : consulta.eq("proyecto_id", entrada.proyectoId);

    const { data, error } = await consulta;
    if (error) throw error;
    return (data ?? []).map(aPresupuesto);
  }

  async existeEnPeriodo(entrada: {
    proyectoId: string | null;
    categoriaId: string;
    periodoInicio: string;
    periodoFin: string;
  }): Promise<boolean> {
    let consulta = this.supabase
      .from("presupuestos")
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", entrada.categoriaId)
      .eq("periodo_inicio", entrada.periodoInicio)
      .eq("periodo_fin", entrada.periodoFin);

    consulta =
      entrada.proyectoId === null
        ? consulta.is("proyecto_id", null)
        : consulta.eq("proyecto_id", entrada.proyectoId);

    const { count, error } = await consulta;
    if (error) throw error;
    return (count ?? 0) > 0;
  }
}
