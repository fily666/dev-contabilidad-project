import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tablas } from "@/shared/infrastructure/supabase/database.types";
import { Movimiento } from "../domain/movimiento.entity";
import type {
  FiltroMovimientos,
  MovimientoListado,
  MovimientoRepository,
  OrdenMovimientos,
  PaginaMovimientos,
  Paginacion,
} from "../domain/movimiento.repository";

type Fila = Tablas<"movimientos">;

const SELECT_LISTADO = `
  id, proyecto_id, fecha, fecha_vencimiento, fecha_pago, tipo, naturaleza,
  categoria_id, valor, moneda, descripcion, observaciones, estado, motivo_anulacion,
  proyectos!inner ( nombre ),
  categorias!inner ( nombre, padre_id ),
  metodos_pago ( nombre )
`;

function aMovimiento(fila: Fila): Movimiento {
  return Movimiento.desdePersistencia({
    id: fila.id,
    propietarioId: fila.propietario_id,
    proyectoId: fila.proyecto_id,
    categoriaId: fila.categoria_id,
    metodoPagoId: fila.metodo_pago_id,
    tipo: fila.tipo,
    naturaleza: fila.naturaleza,
    fecha: fila.fecha,
    fechaVencimiento: fila.fecha_vencimiento,
    fechaPago: fila.fecha_pago,
    valor: Number(fila.valor),
    moneda: fila.moneda,
    abonoCapital: fila.abono_capital === null ? null : Number(fila.abono_capital),
    abonoInteres: fila.abono_interes === null ? null : Number(fila.abono_interes),
    descripcion: fila.descripcion,
    observaciones: fila.observaciones,
    estado: fila.estado,
    motivoAnulacion: fila.motivo_anulacion,
    ocurrenciaId: fila.ocurrencia_id,
  });
}

const COLUMNA_ORDEN: Record<OrdenMovimientos["campo"], string> = {
  fecha: "fecha",
  valor: "valor",
  categoria: "categoria_id",
  estado: "estado",
};

/** ADAPTADOR del puerto MovimientoRepository (Contexto.md §7.3). */
export class SupabaseMovimientoRepository implements MovimientoRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async buscarPorId(id: string, propietarioId: string): Promise<Movimiento | null> {
    const { data, error } = await this.supabase
      .from("movimientos")
      .select("*")
      .eq("id", id)
      .eq("propietario_id", propietarioId)
      .maybeSingle();

    if (error) throw error;
    return data ? aMovimiento(data) : null;
  }

  async listar(
    propietarioId: string,
    filtro: FiltroMovimientos,
    orden: OrdenMovimientos,
    paginacion: Paginacion,
  ): Promise<PaginaMovimientos> {
    const desde = (paginacion.pagina - 1) * paginacion.porPagina;
    const hasta = desde + paginacion.porPagina - 1;

    const consulta = this.aplicarFiltros(
      this.supabase.from("movimientos").select(SELECT_LISTADO, { count: "exact" }),
      propietarioId,
      filtro,
    );

    const [pagina, totales] = await Promise.all([
      consulta
        .order(COLUMNA_ORDEN[orden.campo], { ascending: orden.direccion === "asc" })
        .order("creado_en", { ascending: false })
        .range(desde, hasta),
      this.calcularTotales(propietarioId, filtro),
    ]);

    if (pagina.error) throw pagina.error;

    type FilaListado = {
      id: string;
      proyecto_id: string;
      fecha: string;
      fecha_vencimiento: string | null;
      fecha_pago: string | null;
      tipo: MovimientoListado["tipo"];
      naturaleza: MovimientoListado["naturaleza"];
      categoria_id: string;
      valor: number | string;
      moneda: string;
      descripcion: string;
      observaciones: string | null;
      estado: MovimientoListado["estado"];
      motivo_anulacion: string | null;
      proyectos: { nombre: string } | null;
      categorias: { nombre: string; padre_id: string | null } | null;
      metodos_pago: { nombre: string } | null;
    };

    const filas = (pagina.data ?? []) as unknown as FilaListado[];

    // La ruta legible «Padre › Hijo» necesita el nombre del padre.
    const padresIds = [
      ...new Set(filas.map((f) => f.categorias?.padre_id).filter((id): id is string => !!id)),
    ];
    const nombrePadre = new Map<string, string>();
    if (padresIds.length > 0) {
      const { data, error } = await this.supabase
        .from("categorias")
        .select("id, nombre")
        .in("id", padresIds);
      if (error) throw error;
      for (const c of data ?? []) nombrePadre.set(c.id, c.nombre);
    }

    return {
      filas: filas.map((f) => {
        const categoria = f.categorias?.nombre ?? "—";
        const padre = f.categorias?.padre_id ? nombrePadre.get(f.categorias.padre_id) : undefined;
        return {
          id: f.id,
          proyectoId: f.proyecto_id,
          proyectoNombre: f.proyectos?.nombre ?? "—",
          fecha: f.fecha,
          fechaVencimiento: f.fecha_vencimiento,
          fechaPago: f.fecha_pago,
          tipo: f.tipo,
          naturaleza: f.naturaleza,
          categoriaId: f.categoria_id,
          categoria,
          categoriaRuta: padre ? `${padre} › ${categoria}` : categoria,
          metodoPago: f.metodos_pago?.nombre ?? null,
          valor: Number(f.valor),
          moneda: f.moneda,
          descripcion: f.descripcion,
          observaciones: f.observaciones,
          estado: f.estado,
          motivoAnulacion: f.motivo_anulacion,
        };
      }),
      total: pagina.count ?? 0,
      pagina: paginacion.pagina,
      porPagina: paginacion.porPagina,
      totales,
    };
  }

  async guardar(movimiento: Movimiento, actorId: string): Promise<Movimiento> {
    const d = movimiento.aDatos();
    const { data, error } = await this.supabase
      .from("movimientos")
      .insert({
        id: d.id,
        propietario_id: d.propietarioId,
        proyecto_id: d.proyectoId,
        categoria_id: d.categoriaId,
        metodo_pago_id: d.metodoPagoId,
        tipo: d.tipo,
        naturaleza: d.naturaleza,
        fecha: d.fecha,
        fecha_vencimiento: d.fechaVencimiento,
        fecha_pago: d.fechaPago,
        valor: d.valor,
        moneda: d.moneda,
        abono_capital: d.abonoCapital,
        abono_interes: d.abonoInteres,
        descripcion: d.descripcion,
        observaciones: d.observaciones,
        estado: d.estado,
        ocurrencia_id: d.ocurrenciaId,
        creado_por: actorId,
      })
      .select("*")
      .single();

    if (error) throw error;
    return aMovimiento(data);
  }

  async actualizar(movimiento: Movimiento, actorId: string): Promise<Movimiento> {
    const d = movimiento.aDatos();
    const { data, error } = await this.supabase
      .from("movimientos")
      .update({
        categoria_id: d.categoriaId,
        metodo_pago_id: d.metodoPagoId,
        tipo: d.tipo,
        naturaleza: d.naturaleza,
        fecha: d.fecha,
        fecha_vencimiento: d.fechaVencimiento,
        fecha_pago: d.fechaPago,
        valor: d.valor,
        abono_capital: d.abonoCapital,
        abono_interes: d.abonoInteres,
        descripcion: d.descripcion,
        observaciones: d.observaciones,
        estado: d.estado,
        motivo_anulacion: d.motivoAnulacion,
        actualizado_por: actorId,
      })
      .eq("id", d.id)
      .eq("propietario_id", d.propietarioId)
      .select("*")
      .single();

    if (error) throw error;
    return aMovimiento(data);
  }

  /** Totales del conjunto filtrado completo (no solo de la pagina visible). */
  private async calcularTotales(
    propietarioId: string,
    filtro: FiltroMovimientos,
  ): Promise<PaginaMovimientos["totales"]> {
    const { data, error } = await this.aplicarFiltros(
      this.supabase.from("movimientos").select("tipo, naturaleza, valor, estado"),
      propietarioId,
      filtro,
    );

    if (error) throw error;

    let ingresos = 0;
    let egresos = 0;
    let invertido = 0;

    for (const fila of data ?? []) {
      if (fila.estado === "anulado") continue;
      const valor = Number(fila.valor);
      if (fila.tipo === "ingreso") ingresos += valor;
      else {
        egresos += valor;
        if (fila.naturaleza === "capex") invertido += valor;
      }
    }

    return { ingresos, egresos, invertido };
  }

  private aplicarFiltros<T extends { eq: unknown }>(
    consulta: T,
    propietarioId: string,
    filtro: FiltroMovimientos,
  ): T {
    // Se usa `any` acotado a este metodo: los builders de PostgREST son
    // genericos encadenados y tiparlos aqui no aporta seguridad real.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let q = consulta as any;
    q = q.eq("propietario_id", propietarioId);

    if (filtro.proyectoId) q = q.eq("proyecto_id", filtro.proyectoId);
    if (filtro.desde) q = q.gte("fecha", filtro.desde);
    if (filtro.hasta) q = q.lte("fecha", filtro.hasta);
    if (filtro.tipos?.length) q = q.in("tipo", filtro.tipos);
    if (filtro.naturalezas?.length) q = q.in("naturaleza", filtro.naturalezas);
    if (filtro.categoriaIds?.length) q = q.in("categoria_id", filtro.categoriaIds);
    if (filtro.estados?.length) q = q.in("estado", filtro.estados);
    if (filtro.metodoPagoId) q = q.eq("metodo_pago_id", filtro.metodoPagoId);
    if (filtro.texto) q = q.ilike("descripcion", `%${filtro.texto}%`);

    return q as T;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}
