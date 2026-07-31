import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/database.types";
import type { FlujoMensual } from "@/modules/proyectos/domain/indicadores";
import type {
  DashboardRepository,
  FiltroPanel,
  GastoPorCategoria,
  TotalesGlobales,
} from "../domain/dashboard.repository";

/**
 * ADAPTADOR del puerto DashboardRepository (Contexto.md §7.3).
 *
 * Lee exclusivamente vistas de §6.4. Ninguna formula se reimplementa aqui: la
 * unica aritmetica es sumar filas que la vista ya agrego, que es lo que permite
 * aplicar el rango de fechas de RF-79 sin duplicar definiciones (ADR-11).
 */
export class SupabaseDashboardRepository implements DashboardRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async totalesGlobales(filtro: FiltroPanel = {}): Promise<TotalesGlobales> {
    const filas = await this.leerMensual(filtro);

    const totales = filas.reduce(
      (acc, fila) => {
        const total = Number(fila.total);
        if (fila.tipo === "ingreso") return { ...acc, totalIngresos: acc.totalIngresos + total };
        return {
          ...acc,
          totalEgresos: acc.totalEgresos + total,
          totalInvertido: acc.totalInvertido + (fila.naturaleza === "capex" ? total : 0),
          totalGastosOperativos:
            acc.totalGastosOperativos + (fila.naturaleza === "opex" ? total : 0),
          totalFinanciacion:
            acc.totalFinanciacion + (fila.naturaleza === "financiacion" ? total : 0),
        };
      },
      {
        totalInvertido: 0,
        totalGastosOperativos: 0,
        totalFinanciacion: 0,
        totalIngresos: 0,
        totalEgresos: 0,
      },
    );

    return {
      ...totales,
      balance: totales.totalIngresos - totales.totalEgresos,
      moneda: await this.monedaDeReferencia(filtro.proyectoId),
    };
  }

  async flujoMensual(filtro: FiltroPanel = {}): Promise<FlujoMensual[]> {
    const filas = await this.leerMensual(filtro);
    const porMes = new Map<string, FlujoMensual>();

    for (const fila of filas) {
      const mes = fila.mes;
      const punto = porMes.get(mes) ?? { mes, ingresos: 0, egresos: 0, flujoNeto: 0 };
      const total = Number(fila.total);
      if (fila.tipo === "ingreso") punto.ingresos += total;
      else punto.egresos += total;
      punto.flujoNeto = punto.ingresos - punto.egresos;
      porMes.set(mes, punto);
    }

    return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }

  /** RF-72: proyectado, de la vista que une obligaciones y comprometidos. */
  async flujoProyectado(filtro: FiltroPanel = {}): Promise<FlujoMensual[]> {
    let consulta = this.supabase
      .from("v_flujo_proyectado_mensual")
      .select("mes, ingresos_esperados, egresos_estimados, flujo_proyectado")
      .order("mes", { ascending: true });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    if (filtro.desde) consulta = consulta.gte("mes", primerDiaDelMes(filtro.desde));
    if (filtro.hasta) consulta = consulta.lte("mes", primerDiaDelMes(filtro.hasta));

    const { data, error } = await consulta;
    if (error) throw error;

    const porMes = new Map<string, FlujoMensual>();
    for (const fila of data ?? []) {
      const punto = porMes.get(fila.mes) ?? {
        mes: fila.mes,
        ingresos: 0,
        egresos: 0,
        flujoNeto: 0,
      };
      punto.ingresos += Number(fila.ingresos_esperados);
      punto.egresos += Number(fila.egresos_estimados);
      punto.flujoNeto = punto.ingresos - punto.egresos;
      porMes.set(fila.mes, punto);
    }

    return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
  }

  async gastosPorCategoria(filtro: FiltroPanel = {}): Promise<GastoPorCategoria[]> {
    let consulta = this.supabase
      .from("v_gastos_mensual_categoria")
      .select("categoria_id, categoria_raiz, naturaleza, total, cantidad");

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    if (filtro.desde) consulta = consulta.gte("mes", primerDiaDelMes(filtro.desde));
    if (filtro.hasta) consulta = consulta.lte("mes", primerDiaDelMes(filtro.hasta));

    const { data, error } = await consulta;
    if (error) throw error;

    const porCategoria = new Map<string, GastoPorCategoria>();
    for (const fila of data ?? []) {
      const actual = porCategoria.get(fila.categoria_id) ?? {
        categoriaId: fila.categoria_id,
        categoria: fila.categoria_raiz,
        naturaleza: fila.naturaleza,
        total: 0,
        cantidad: 0,
      };
      actual.total += Number(fila.total);
      actual.cantidad += Number(fila.cantidad);
      porCategoria.set(fila.categoria_id, actual);
    }

    return [...porCategoria.values()].sort((a, b) => b.total - a.total);
  }

  private async leerMensual(filtro: FiltroPanel) {
    let consulta = this.supabase
      .from("v_movimientos_mensual")
      .select("mes, tipo, naturaleza, total")
      .order("mes", { ascending: true });

    if (filtro.proyectoId) consulta = consulta.eq("proyecto_id", filtro.proyectoId);
    if (filtro.desde) consulta = consulta.gte("mes", primerDiaDelMes(filtro.desde));
    if (filtro.hasta) consulta = consulta.lte("mes", primerDiaDelMes(filtro.hasta));

    const { data, error } = await consulta;
    if (error) throw error;
    return data ?? [];
  }

  /**
   * v1 es de moneda unica (§17), pero las cifras se presentan con una moneda y
   * hay que elegirla: la del proyecto filtrado, o la de los ajustes si el panel
   * es global.
   */
  private async monedaDeReferencia(proyectoId?: string): Promise<string> {
    if (proyectoId) {
      const { data, error } = await this.supabase
        .from("proyectos")
        .select("moneda")
        .eq("id", proyectoId)
        .maybeSingle();
      if (error) throw error;
      if (data?.moneda) return data.moneda;
    }

    const { data, error } = await this.supabase.from("ajustes").select("moneda").maybeSingle();
    if (error) throw error;
    return data?.moneda ?? "COP";
  }
}

/** Las vistas agregan por mes: el filtro se lleva al primer dia. */
function primerDiaDelMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}
