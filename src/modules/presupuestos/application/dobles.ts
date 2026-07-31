import type { Presupuesto } from "../domain/presupuesto.entity";
import type {
  EjecucionPresupuesto,
  FiltroPresupuestos,
  PresupuestoRepository,
} from "../domain/presupuesto.repository";

/**
 * Doble en memoria del puerto PresupuestoRepository (Contexto.md §8.8).
 *
 * El gasto real lo declara la prueba en `realPorCategoria`: calcularlo aqui
 * seria reimplementar `v_presupuesto_ejecucion`, y esa vista la verifican las
 * pruebas de esquema. Lo que se prueba en este nivel es la desviacion, la
 * alerta y la copia de periodo.
 */
export class PresupuestoRepositoryEnMemoria implements PresupuestoRepository {
  readonly filas = new Map<string, Presupuesto>();
  readonly realPorCategoria = new Map<string, number>();
  eliminados: string[] = [];

  async buscarPorId(id: string): Promise<Presupuesto | null> {
    return this.filas.get(id) ?? null;
  }

  async listarEjecucion(filtro: FiltroPresupuestos = {}): Promise<EjecucionPresupuesto[]> {
    return [...this.filas.values()]
      .filter((p) => !filtro.proyectoId || p.proyectoId === filtro.proyectoId)
      .filter((p) => !filtro.hasta || p.periodoInicio <= filtro.hasta)
      .filter((p) => !filtro.desde || p.periodoFin >= filtro.desde)
      .filter(
        (p) =>
          !filtro.vigenteEn ||
          (p.periodoInicio <= filtro.vigenteEn && p.periodoFin >= filtro.vigenteEn),
      )
      .map((p) => {
        const real = this.realPorCategoria.get(`${p.categoriaId}:${p.periodoInicio}`) ?? 0;
        const planeado = p.valorPlaneado;

        return {
          presupuestoId: p.id,
          proyectoId: p.proyectoId,
          proyecto: p.proyectoId ? "Proyecto" : null,
          categoriaId: p.categoriaId,
          categoria: "Categoría",
          naturaleza: "opex" as const,
          periodoInicio: p.periodoInicio,
          periodoFin: p.periodoFin,
          valorPlaneado: planeado,
          valorReal: real,
          desviacion: Math.round((real - planeado) * 100) / 100,
          ejecucion: planeado > 0 ? real / planeado : null,
          movimientos: real > 0 ? 1 : 0,
          moneda: "COP",
        };
      })
      .sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio));
  }

  async guardar(presupuesto: Presupuesto): Promise<Presupuesto> {
    this.filas.set(presupuesto.id, presupuesto);
    return presupuesto;
  }

  async actualizar(presupuesto: Presupuesto): Promise<Presupuesto> {
    this.filas.set(presupuesto.id, presupuesto);
    return presupuesto;
  }

  async eliminar(id: string): Promise<void> {
    this.filas.delete(id);
    this.eliminados.push(id);
  }

  async listarDePeriodo(entrada: {
    proyectoId?: string | null;
    periodoInicio: string;
    periodoFin: string;
  }): Promise<Presupuesto[]> {
    const proyectoId = entrada.proyectoId ?? null;
    return [...this.filas.values()].filter(
      (p) =>
        p.proyectoId === proyectoId &&
        p.periodoInicio === entrada.periodoInicio &&
        p.periodoFin === entrada.periodoFin,
    );
  }

  async existeEnPeriodo(entrada: {
    proyectoId: string | null;
    categoriaId: string;
    periodoInicio: string;
    periodoFin: string;
  }): Promise<boolean> {
    return [...this.filas.values()].some(
      (p) =>
        p.proyectoId === entrada.proyectoId &&
        p.categoriaId === entrada.categoriaId &&
        p.periodoInicio === entrada.periodoInicio &&
        p.periodoFin === entrada.periodoFin,
    );
  }
}
