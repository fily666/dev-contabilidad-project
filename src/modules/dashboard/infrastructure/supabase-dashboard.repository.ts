import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/database.types";
import type { FlujoMensual } from "@/modules/proyectos/domain/indicadores";
import type {
  DashboardRepository,
  FiltroPanel,
  GastoPorCategoria,
  FlujoRecientePorProyecto,
  TotalesGlobales,
  TotalesPorProyecto,
} from "../domain/dashboard.repository";

/**
 * Las columnas de `v_movimientos_mensual` que consume el panel. Se derivan del
 * tipo verificado contra la base (`npm run db:verify-types`) en lugar de
 * redeclararse, para que una columna renombrada rompa la compilacion.
 */
type FilaMensual = Pick<
  Database["public"]["Views"]["v_movimientos_mensual"]["Row"],
  "proyecto_id" | "mes" | "tipo" | "naturaleza" | "total"
>;

/** Acumulador de los agregados de §5.1 mientras se recorren las filas. */
type Acumulado = {
  totalInvertido: number;
  totalGastosOperativos: number;
  totalFinanciacion: number;
  totalIngresos: number;
  totalEgresos: number;
};

const CERO: () => Acumulado = () => ({
  totalInvertido: 0,
  totalGastosOperativos: 0,
  totalFinanciacion: 0,
  totalIngresos: 0,
  totalEgresos: 0,
});

/**
 * Reparto de §5.1: el tipo decide el lado y la naturaleza decide el cajon. Vive
 * en una sola funcion porque la usan el total global y el total por proyecto, y
 * dos copias eran dos sitios donde el capex podia dejar de contar como egreso.
 */
function acumular(acc: Acumulado, tipo: string, naturaleza: string, valor: number): void {
  if (tipo === "ingreso") {
    acc.totalIngresos += valor;
    return;
  }
  acc.totalEgresos += valor;
  if (naturaleza === "capex") acc.totalInvertido += valor;
  else if (naturaleza === "opex") acc.totalGastosOperativos += valor;
  else if (naturaleza === "financiacion") acc.totalFinanciacion += valor;
}

/**
 * ADAPTADOR del puerto DashboardRepository (Contexto.md §7.3).
 *
 * Lee exclusivamente vistas de §6.4. Ninguna formula se reimplementa aqui: la
 * unica aritmetica es sumar filas que la vista ya agrego, que es lo que permite
 * aplicar el rango de fechas de RF-79 sin duplicar definiciones (ADR-11).
 */
export class SupabaseDashboardRepository implements DashboardRepository {
  /**
   * Memoria de las lecturas de `v_movimientos_mensual` dentro de este request.
   *
   * Tres metodos del panel —totales globales, flujo mensual y totales por
   * proyecto— se sirven de la misma consulta con el mismo filtro. Sin esto, una
   * sola carga del dashboard la pedia tres veces.
   *
   * Es seguro porque el contenedor se construye por request (§7.2): el adaptador
   * no vive mas alla de la peticion, asi que no puede servir datos rancios.
   */
  private readonly mensualPorFiltro = new Map<string, Promise<FilaMensual[]>>();

  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async totalesGlobales(filtro: FiltroPanel = {}): Promise<TotalesGlobales> {
    const filas = await this.leerMensual(filtro);

    const totales = CERO();
    for (const fila of filas) {
      acumular(totales, fila.tipo, fila.naturaleza, Number(fila.total));
    }

    return {
      ...totales,
      balance: totales.totalIngresos - totales.totalEgresos,
      moneda: await this.monedaDeReferencia(filtro.proyectoId),
    };
  }

  /**
   * RF-74, RF-77: los mismos totales del rango, desglosados por proyecto.
   *
   * Solo devuelve proyectos con movimientos pagados en el rango; los demas no
   * aparecen en la vista. Quien compone el panel debe tratar la ausencia como
   * ceros, no como «proyecto inexistente».
   */
  async totalesPorProyecto(filtro: FiltroPanel = {}): Promise<TotalesPorProyecto[]> {
    const filas = await this.leerMensual(filtro);
    const porProyecto = new Map<string, Acumulado>();

    for (const fila of filas) {
      let acc = porProyecto.get(fila.proyecto_id);
      if (!acc) {
        acc = CERO();
        porProyecto.set(fila.proyecto_id, acc);
      }
      acumular(acc, fila.tipo, fila.naturaleza, Number(fila.total));
    }

    return [...porProyecto.entries()].map(([proyectoId, acc]) => ({
      proyectoId,
      ...acc,
      balance: acc.totalIngresos - acc.totalEgresos,
    }));
  }

  /**
   * §5.5: una sola consulta para el flujo reciente de TODOS los proyectos.
   *
   * No reutiliza `leerMensual` a propósito: aquella lleva el rango del panel y
   * esta necesita una ventana anclada a hoy. Compartir la caché entre las dos
   * habría devuelto la serie equivocada en cuanto el usuario cambiara el rango.
   */
  async flujoRecientePorProyecto(desdeMes: string): Promise<FlujoRecientePorProyecto[]> {
    const { data, error } = await this.supabase
      .from("v_movimientos_mensual")
      .select("proyecto_id, tipo, total")
      .gte("mes", primerDiaDelMes(desdeMes));

    if (error) throw error;

    const porProyecto = new Map<string, number>();
    for (const fila of data ?? []) {
      const signo = fila.tipo === "ingreso" ? 1 : -1;
      porProyecto.set(
        fila.proyecto_id,
        (porProyecto.get(fila.proyecto_id) ?? 0) + signo * Number(fila.total),
      );
    }

    return [...porProyecto.entries()].map(([proyectoId, flujoNeto]) => ({
      proyectoId,
      flujoNeto,
    }));
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

  /**
   * Lectura unica de `v_movimientos_mensual` por filtro, memorizada para este
   * request. Se guarda la promesa y no el resultado, de modo que dos llamadas
   * concurrentes —el panel las lanza en `Promise.all`— compartan la misma
   * peticion en vuelo en lugar de disparar dos.
   */
  private leerMensual(filtro: FiltroPanel): Promise<FilaMensual[]> {
    const clave = `${filtro.proyectoId ?? ""}|${filtro.desde ?? ""}|${filtro.hasta ?? ""}`;
    const memorizada = this.mensualPorFiltro.get(clave);
    if (memorizada) return memorizada;

    const pendiente = this.consultarMensual(filtro);
    this.mensualPorFiltro.set(clave, pendiente);
    return pendiente;
  }

  private async consultarMensual(filtro: FiltroPanel): Promise<FilaMensual[]> {
    let consulta = this.supabase
      .from("v_movimientos_mensual")
      .select("proyecto_id, mes, tipo, naturaleza, total")
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
