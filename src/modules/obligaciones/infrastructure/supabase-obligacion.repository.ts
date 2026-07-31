import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Obligacion } from "../domain/obligacion.entity";
import { Ocurrencia } from "../domain/ocurrencia.entity";
import type {
  EventoAgenda,
  FiltroAgenda,
  FiltroObligaciones,
  ObligacionListada,
  ObligacionRepository,
  OcurrenciaListada,
} from "../domain/obligacion.repository";

type Fila = Tablas<"obligaciones">;
type FilaOcurrencia = Tablas<"ocurrencias_obligacion">;

const SELECT_LISTADO = `
  id, proyecto_id, categoria_id, concepto, valor_estimado, fecha_vencimiento,
  frecuencia, intervalo_meses, dias_aviso, crear_movimiento_auto, activa,
  proyectos!inner ( nombre, moneda, tipo_proyecto_id ),
  categorias!inner ( nombre ),
  ocurrencias_obligacion ( fecha_vencimiento, estado )
`;

function aObligacion(fila: Fila): Obligacion {
  return Obligacion.desdePersistencia({
    id: fila.id,
    proyectoId: fila.proyecto_id,
    categoriaId: fila.categoria_id,
    concepto: fila.concepto,
    valorEstimado: Number(fila.valor_estimado),
    fechaVencimiento: fila.fecha_vencimiento,
    frecuencia: fila.frecuencia,
    intervaloMeses: fila.intervalo_meses,
    diasAviso: fila.dias_aviso,
    crearMovimientoAuto: fila.crear_movimiento_auto,
    activa: fila.activa,
  });
}

function aOcurrencia(fila: FilaOcurrencia): Ocurrencia {
  return Ocurrencia.desdePersistencia({
    id: fila.id,
    obligacionId: fila.obligacion_id,
    fechaVencimiento: fila.fecha_vencimiento,
    valorEstimado: Number(fila.valor_estimado),
    estado: fila.estado,
    movimientoId: fila.movimiento_id,
  });
}

/** ADAPTADOR del puerto ObligacionRepository (Contexto.md §7.3). */
export class SupabaseObligacionRepository implements ObligacionRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string): Promise<Obligacion | null> {
    const { data, error } = await this.supabase
      .from("obligaciones")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aObligacion(data) : null;
  }

  async listar(filtro: FiltroObligaciones = {}): Promise<ObligacionListada[]> {
    let consulta = this.supabase
      .from("obligaciones")
      .select(SELECT_LISTADO)
      .order("fecha_vencimiento", { ascending: true });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    if (filtro.soloActivas) consulta = consulta.eq("activa", true);
    if (filtro.texto) consulta = consulta.ilike("concepto", `%${filtro.texto}%`);

    const { data, error } = await consulta;
    if (error) throw error;

    type FilaListado = Fila & {
      proyectos: { nombre: string; moneda: string; tipo_proyecto_id: string } | null;
      categorias: { nombre: string } | null;
      ocurrencias_obligacion: Array<{ fecha_vencimiento: string; estado: string }> | null;
    };

    return ((data ?? []) as unknown as FilaListado[]).map((f) => {
      const ocurrencias = f.ocurrencias_obligacion ?? [];
      const abiertas = ocurrencias
        .filter((o) => o.estado === "pendiente" || o.estado === "vencida")
        .map((o) => o.fecha_vencimiento)
        .sort();

      return {
        id: f.id,
        proyectoId: f.proyecto_id,
        proyectoNombre: f.proyectos?.nombre ?? "—",
        tipoProyectoId: f.proyectos?.tipo_proyecto_id ?? "",
        categoriaId: f.categoria_id,
        categoria: f.categorias?.nombre ?? "—",
        concepto: f.concepto,
        valorEstimado: Number(f.valor_estimado),
        moneda: f.proyectos?.moneda ?? "COP",
        fechaVencimiento: f.fecha_vencimiento,
        frecuencia: f.frecuencia,
        intervaloMeses: f.intervalo_meses,
        diasAviso: f.dias_aviso,
        activa: f.activa,
        proximoVencimiento: abiertas[0] ?? null,
        ocurrenciasPendientes: ocurrencias.filter((o) => o.estado === "pendiente").length,
        ocurrenciasVencidas: ocurrencias.filter((o) => o.estado === "vencida").length,
      };
    });
  }

  async guardar(obligacion: Obligacion): Promise<Obligacion> {
    const d = obligacion.aDatos();
    const { data, error } = await this.supabase
      .from("obligaciones")
      .insert({
        id: d.id,
        proyecto_id: d.proyectoId,
        categoria_id: d.categoriaId,
        concepto: d.concepto,
        valor_estimado: d.valorEstimado,
        fecha_vencimiento: d.fechaVencimiento,
        frecuencia: d.frecuencia,
        intervalo_meses: d.intervaloMeses,
        dias_aviso: d.diasAviso,
        crear_movimiento_auto: d.crearMovimientoAuto,
        activa: d.activa,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aObligacion(data);
  }

  async actualizar(obligacion: Obligacion): Promise<Obligacion> {
    const d = obligacion.aDatos();
    const { data, error } = await this.supabase
      .from("obligaciones")
      .update({
        categoria_id: d.categoriaId,
        concepto: d.concepto,
        valor_estimado: d.valorEstimado,
        fecha_vencimiento: d.fechaVencimiento,
        frecuencia: d.frecuencia,
        intervalo_meses: d.intervaloMeses,
        dias_aviso: d.diasAviso,
        crear_movimiento_auto: d.crearMovimientoAuto,
        activa: d.activa,
      })
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) throw error;
    return aObligacion(data);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from("obligaciones").delete().eq("id", id);
    if (error) throw error;
  }

  async contarOcurrenciasPagadas(obligacionId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("ocurrencias_obligacion")
      .select("id", { count: "exact", head: true })
      .eq("obligacion_id", obligacionId)
      .eq("estado", "pagada");

    if (error) throw error;
    return count ?? 0;
  }

  async buscarOcurrencia(id: string): Promise<Ocurrencia | null> {
    const { data, error } = await this.supabase
      .from("ocurrencias_obligacion")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? aOcurrencia(data) : null;
  }

  async actualizarOcurrencia(ocurrencia: Ocurrencia): Promise<Ocurrencia> {
    const d = ocurrencia.aDatos();
    const { data, error } = await this.supabase
      .from("ocurrencias_obligacion")
      .update({
        estado: d.estado,
        movimiento_id: d.movimientoId,
        valor_estimado: d.valorEstimado,
        fecha_vencimiento: d.fechaVencimiento,
      })
      .eq("id", d.id)
      .select("*")
      .single();

    if (error) throw error;
    return aOcurrencia(data);
  }

  async listarOcurrencias(obligacionId: string): Promise<OcurrenciaListada[]> {
    const { data, error } = await this.supabase
      .from("ocurrencias_obligacion")
      .select("id, fecha_vencimiento, valor_estimado, estado, movimiento_id")
      .eq("obligacion_id", obligacionId)
      .order("fecha_vencimiento", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((f) => ({
      id: f.id,
      fechaVencimiento: f.fecha_vencimiento,
      valorEstimado: Number(f.valor_estimado),
      estado: f.estado,
      movimientoId: f.movimiento_id,
    }));
  }

  /** RF-58, RF-73: se lee de la vista para no reimplementar `dias_restantes`. */
  async listarAgenda(filtro: FiltroAgenda = {}): Promise<EventoAgenda[]> {
    let consulta = this.supabase
      .from("v_agenda_obligaciones")
      .select("*")
      .order("fecha_vencimiento", { ascending: true });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    if (filtro.estados?.length) consulta = consulta.in("estado", filtro.estados);
    if (filtro.desde) consulta = consulta.gte("fecha_vencimiento", filtro.desde);
    if (filtro.hasta) consulta = consulta.lte("fecha_vencimiento", filtro.hasta);

    if (filtro.dentroDeDias !== undefined) {
      consulta = consulta.lte("dias_restantes", filtro.dentroDeDias);
      // Sin `incluirVencidas` la ventana empieza hoy; con ella, tambien entra lo
      // que ya vencio, que es lo que pide RF-58.
      if (!filtro.incluirVencidas) consulta = consulta.gte("dias_restantes", 0);
    } else if (filtro.incluirVencidas === false) {
      consulta = consulta.gte("dias_restantes", 0);
    }

    const { data, error } = await consulta;
    if (error) throw error;

    return (data ?? []).map((f) => ({
      ocurrenciaId: f.ocurrencia_id,
      obligacionId: f.obligacion_id,
      proyectoId: f.proyecto_id,
      proyectoNombre: f.proyecto,
      concepto: f.concepto,
      categoriaId: f.categoria_id,
      fechaVencimiento: f.fecha_vencimiento,
      valorEstimado: Number(f.valor_estimado),
      moneda: f.moneda,
      estado: f.estado,
      diasRestantes: Number(f.dias_restantes),
      movimientoId: f.movimiento_id,
    }));
  }

  /** RF-52: la funcion de §6.6 es idempotente; aqui solo se invoca. */
  async generarOcurrencias(horizonteMeses: number): Promise<number> {
    const { data, error } = await this.supabase.rpc("generar_ocurrencias", {
      p_horizonte_meses: horizonteMeses,
    });

    if (error) throw error;
    return Number(data ?? 0);
  }

  async marcarVencidos(): Promise<number> {
    const { data, error } = await this.supabase.rpc("marcar_vencidos");
    if (error) throw error;
    return Number(data ?? 0);
  }
}
