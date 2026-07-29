import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/database.types";
import type { FechaIso } from "@/shared/domain/reloj";
import type { CifrasProyecto, FlujoMensual } from "../domain/indicadores";
import type { Proyecto } from "../domain/proyecto.entity";
import type {
  FiltroProyectos,
  ProyectoRepository,
  ResumenProyecto,
} from "../domain/proyecto.repository";
import { aFilaProyecto, aProyecto } from "./proyecto.mapper";

/** ADAPTADOR del puerto ProyectoRepository (Contexto.md §7.3). */
export class SupabaseProyectoRepository implements ProyectoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string, propietarioId: string): Promise<Proyecto | null> {
    const { data, error } = await this.supabase
      .from("proyectos")
      .select("*")
      .eq("id", id)
      .eq("propietario_id", propietarioId)
      .maybeSingle();

    if (error) throw error;
    return data ? aProyecto(data) : null;
  }

  async listar(propietarioId: string, filtro?: FiltroProyectos): Promise<ResumenProyecto[]> {
    // Las vistas no tienen relacion declarada con proyectos, asi que PostgREST
    // no puede anidarlas: se consultan aparte y se unen aqui.
    let consulta = this.supabase
      .from("proyectos")
      .select(
        `id, nombre, estado, fecha_inicio, moneda, tipos_proyecto!inner ( codigo, nombre, icono )`,
      )
      .eq("propietario_id", propietarioId);

    if (filtro?.estados?.length) consulta = consulta.in("estado", filtro.estados);
    if (filtro?.tipoProyectoId) consulta = consulta.eq("tipo_proyecto_id", filtro.tipoProyectoId);
    if (filtro?.texto) consulta = consulta.ilike("nombre", `%${filtro.texto}%`);

    const [proyectos, resumenes] = await Promise.all([
      consulta.order("creado_en", { ascending: false }),
      this.supabase.from("v_resumen_proyecto").select("*").eq("propietario_id", propietarioId),
    ]);

    if (proyectos.error) throw proyectos.error;
    if (resumenes.error) throw resumenes.error;

    const porProyecto = new Map((resumenes.data ?? []).map((r) => [r.proyecto_id, r]));

    type Fila = {
      id: string;
      nombre: string;
      estado: ResumenProyecto["estado"];
      fecha_inicio: string;
      moneda: string;
      tipos_proyecto: { codigo: string; nombre: string; icono: string | null } | null;
    };

    return ((proyectos.data ?? []) as unknown as Fila[]).map((fila) => {
      const resumen = porProyecto.get(fila.id);
      return {
        proyectoId: fila.id,
        nombre: fila.nombre,
        tipoCodigo: fila.tipos_proyecto?.codigo ?? "otro",
        tipoNombre: fila.tipos_proyecto?.nombre ?? "Otro",
        icono: fila.tipos_proyecto?.icono ?? null,
        estado: fila.estado,
        fechaInicio: fila.fecha_inicio,
        moneda: fila.moneda,
        totalInvertido: Number(resumen?.total_invertido ?? 0),
        totalIngresos: Number(resumen?.total_ingresos ?? 0),
        totalEgresos: Number(resumen?.total_egresos ?? 0),
        balance: Number(resumen?.balance ?? 0),
        ultimoMovimiento: resumen?.ultimo_movimiento ?? null,
      };
    });
  }

  async guardar(proyecto: Proyecto, actorId: string): Promise<Proyecto> {
    const { data, error } = await this.supabase
      .from("proyectos")
      .insert(aFilaProyecto(proyecto, actorId))
      .select("*")
      .single();

    if (error) throw error;
    return aProyecto(data);
  }

  async actualizar(proyecto: Proyecto, actorId: string): Promise<Proyecto> {
    const d = proyecto.aDatos();
    const { data, error } = await this.supabase
      .from("proyectos")
      .update({
        tipo_proyecto_id: d.tipoProyectoId,
        nombre: d.nombre,
        descripcion: d.descripcion,
        fecha_inicio: d.fechaInicio,
        fecha_fin: d.fechaFin,
        estado: d.estado,
        atributos: d.atributos,
        actualizado_por: actorId,
      })
      .eq("id", d.id)
      .eq("propietario_id", d.propietarioId)
      .select("*")
      .single();

    if (error) throw error;
    return aProyecto(data);
  }

  async eliminar(id: string, propietarioId: string): Promise<void> {
    const { error } = await this.supabase
      .from("proyectos")
      .delete()
      .eq("id", id)
      .eq("propietario_id", propietarioId);

    if (error) throw error;
  }

  async contarMovimientos(proyectoId: string, propietarioId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("movimientos")
      .select("id", { count: "exact", head: true })
      .eq("proyecto_id", proyectoId)
      .eq("propietario_id", propietarioId);

    if (error) throw error;
    return count ?? 0;
  }

  /** Lee los agregados de las vistas de §6.4 y los entrega al dominio. */
  async obtenerCifras(
    proyectoId: string,
    propietarioId: string,
    hoy: FechaIso,
  ): Promise<CifrasProyecto> {
    const [proyecto, resumen, metricas, flujo, patrimonio] = await Promise.all([
      this.supabase
        .from("proyectos")
        .select("fecha_inicio, moneda")
        .eq("id", proyectoId)
        .eq("propietario_id", propietarioId)
        .single(),
      this.supabase
        .from("v_resumen_proyecto")
        .select("*")
        .eq("proyecto_id", proyectoId)
        .maybeSingle(),
      this.supabase.from("v_metricas_12m").select("*").eq("proyecto_id", proyectoId).maybeSingle(),
      this.supabase
        .from("v_flujo_caja_mensual")
        .select("mes, ingresos, egresos, flujo_neto")
        .eq("proyecto_id", proyectoId)
        .order("mes"),
      this.supabase
        .from("v_patrimonio_proyecto")
        .select("valoracion_actual, pasivo_total")
        .eq("proyecto_id", proyectoId)
        .maybeSingle(),
    ]);

    if (proyecto.error) throw proyecto.error;
    if (resumen.error) throw resumen.error;
    if (metricas.error) throw metricas.error;
    if (flujo.error) throw flujo.error;
    if (patrimonio.error) throw patrimonio.error;

    const flujoMensual: FlujoMensual[] = (flujo.data ?? []).map((f) => ({
      mes: f.mes,
      ingresos: Number(f.ingresos),
      egresos: Number(f.egresos),
      flujoNeto: Number(f.flujo_neto),
    }));

    return {
      moneda: proyecto.data.moneda,
      fechaInicio: proyecto.data.fecha_inicio,
      hoy,
      totalInvertido: Number(resumen.data?.total_invertido ?? 0),
      totalGastosOperativos: Number(resumen.data?.total_gastos_operativos ?? 0),
      totalFinanciacion: Number(resumen.data?.total_financiacion ?? 0),
      totalIngresos: Number(resumen.data?.total_ingresos ?? 0),
      abonosACapital: Number(resumen.data?.abonos_a_capital ?? 0),
      ingresos12m: Number(metricas.data?.ingresos_12m ?? 0),
      gastosOperativos12m: Number(metricas.data?.gastos_operativos_12m ?? 0),
      valoracionActual:
        patrimonio.data?.valoracion_actual === null ||
        patrimonio.data?.valoracion_actual === undefined
          ? null
          : Number(patrimonio.data.valoracion_actual),
      pasivoTotal: Number(patrimonio.data?.pasivo_total ?? 0),
      flujoMensual,
    };
  }
}
