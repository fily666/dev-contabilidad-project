import type { Movimiento } from "../domain/movimiento.entity";
import type {
  FiltroMovimientos,
  MovimientoListado,
  MovimientoRepository,
  OrdenMovimientos,
  PaginaMovimientos,
  Paginacion,
} from "../domain/movimiento.repository";

/**
 * Doble en memoria del puerto MovimientoRepository (Contexto.md §8.8).
 *
 * Reproduce lo que el adaptador delega a SQL —filtros, orden, paginacion y
 * totales del conjunto filtrado— para que las pruebas de los casos de uso
 * verifiquen el contrato del puerto y no la implementacion de PostgREST.
 */
export class MovimientoRepositoryEnMemoria implements MovimientoRepository {
  readonly filas = new Map<string, Movimiento>();
  /** Nombres resueltos que el adaptador real obtiene por join. */
  readonly nombres = { proyecto: "Proyecto", categoria: "Categoría", metodoPago: "Transferencia" };

  constructor(iniciales: Movimiento[] = []) {
    for (const movimiento of iniciales) this.filas.set(movimiento.id, movimiento);
  }

  async buscarPorId(id: string): Promise<Movimiento | null> {
    return this.filas.get(id) ?? null;
  }

  async listar(
    filtro: FiltroMovimientos,
    orden: OrdenMovimientos,
    paginacion: Paginacion,
  ): Promise<PaginaMovimientos> {
    const coincidentes = [...this.filas.values()].filter((m) => {
      const d = m.aDatos();
      if (filtro.proyectoId && d.proyectoId !== filtro.proyectoId) return false;
      if (filtro.desde && d.fecha < filtro.desde) return false;
      if (filtro.hasta && d.fecha > filtro.hasta) return false;
      if (filtro.tipos?.length && !filtro.tipos.includes(d.tipo)) return false;
      if (filtro.naturalezas?.length && !filtro.naturalezas.includes(d.naturaleza)) return false;
      if (filtro.categoriaIds?.length && !filtro.categoriaIds.includes(d.categoriaId)) return false;
      if (filtro.estados?.length && !filtro.estados.includes(d.estado)) return false;
      if (filtro.metodoPagoId && d.metodoPagoId !== filtro.metodoPagoId) return false;
      if (filtro.texto && !d.descripcion.toLowerCase().includes(filtro.texto.toLowerCase())) {
        return false;
      }
      return true;
    });

    const signo = orden.direccion === "asc" ? 1 : -1;
    const ordenadas = [...coincidentes].sort((a, b) => {
      const da = a.aDatos();
      const db = b.aDatos();
      switch (orden.campo) {
        case "valor":
          return (da.valor - db.valor) * signo;
        case "categoria":
          return da.categoriaId.localeCompare(db.categoriaId) * signo;
        case "estado":
          return da.estado.localeCompare(db.estado) * signo;
        default:
          return da.fecha.localeCompare(db.fecha) * signo;
      }
    });

    const inicio = (paginacion.pagina - 1) * paginacion.porPagina;
    const pagina = ordenadas.slice(inicio, inicio + paginacion.porPagina);

    // Los totales son del conjunto filtrado completo y excluyen los anulados
    // (RF-22, ADR-12), igual que en el adaptador real.
    const totales = coincidentes.reduce(
      (acc, m) => {
        const d = m.aDatos();
        if (d.estado === "anulado") return acc;
        if (d.tipo === "ingreso") return { ...acc, ingresos: acc.ingresos + d.valor };
        return {
          ...acc,
          egresos: acc.egresos + d.valor,
          invertido: acc.invertido + (d.naturaleza === "capex" ? d.valor : 0),
        };
      },
      { ingresos: 0, egresos: 0, invertido: 0 },
    );

    return {
      filas: pagina.map((m) => this.aListado(m)),
      total: coincidentes.length,
      pagina: paginacion.pagina,
      porPagina: paginacion.porPagina,
      totales,
    };
  }

  async guardar(movimiento: Movimiento): Promise<Movimiento> {
    this.filas.set(movimiento.id, movimiento);
    return movimiento;
  }

  async actualizar(movimiento: Movimiento): Promise<Movimiento> {
    this.filas.set(movimiento.id, movimiento);
    return movimiento;
  }

  private aListado(movimiento: Movimiento): MovimientoListado {
    const d = movimiento.aDatos();
    return {
      id: d.id,
      proyectoId: d.proyectoId,
      proyectoNombre: this.nombres.proyecto,
      fecha: d.fecha,
      fechaVencimiento: d.fechaVencimiento,
      fechaPago: d.fechaPago,
      tipo: d.tipo,
      naturaleza: d.naturaleza,
      categoriaId: d.categoriaId,
      categoria: this.nombres.categoria,
      categoriaRuta: this.nombres.categoria,
      metodoPago: d.metodoPagoId ? this.nombres.metodoPago : null,
      valor: d.valor,
      moneda: d.moneda,
      descripcion: d.descripcion,
      observaciones: d.observaciones,
      estado: d.estado,
      estadoEfectivo: d.estado,
      motivoAnulacion: d.motivoAnulacion,
    };
  }
}
