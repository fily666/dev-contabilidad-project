import type { EstadoMovimiento, Naturaleza, TipoMovimiento } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { Movimiento } from "./movimiento.entity";

/** PUERTO (Contexto.md §7.3). */

/** RF-23: filtros combinables. */
export type FiltroMovimientos = {
  proyectoId?: string;
  desde?: FechaIso;
  hasta?: FechaIso;
  tipos?: TipoMovimiento[];
  naturalezas?: Naturaleza[];
  categoriaIds?: string[];
  estados?: EstadoMovimiento[];
  metodoPagoId?: string;
  /** Busqueda libre en la descripcion. */
  texto?: string;
};

export type OrdenMovimientos = {
  campo: "fecha" | "valor" | "categoria" | "estado";
  direccion: "asc" | "desc";
};

export type Paginacion = { pagina: number; porPagina: number };

/** Fila lista para la tabla: incluye los nombres ya resueltos. */
export type MovimientoListado = {
  id: string;
  proyectoId: string;
  proyectoNombre: string;
  fecha: FechaIso;
  fechaVencimiento: FechaIso | null;
  fechaPago: FechaIso | null;
  tipo: TipoMovimiento;
  naturaleza: Naturaleza;
  categoriaId: string;
  categoria: string;
  categoriaRuta: string;
  metodoPago: string | null;
  valor: number;
  moneda: string;
  descripcion: string;
  observaciones: string | null;
  estado: EstadoMovimiento;
  /**
   * RF-25: `pendiente` con vencimiento pasado se presenta como `vencido` aunque
   * la tarea diaria (§10.1) todavia no haya sincronizado el estado persistido.
   * Lo calcula el caso de uso, que es quien conoce la fecha de negocio de hoy.
   */
  estadoEfectivo: EstadoMovimiento;
  motivoAnulacion: string | null;
};

export type PaginaMovimientos = {
  filas: MovimientoListado[];
  total: number;
  pagina: number;
  porPagina: number;
  /** Totales del conjunto filtrado completo, no solo de la pagina. */
  totales: { ingresos: number; egresos: number; invertido: number };
};

export interface MovimientoRepository {
  buscarPorId(id: string): Promise<Movimiento | null>;
  listar(
    filtro: FiltroMovimientos,
    orden: OrdenMovimientos,
    paginacion: Paginacion,
  ): Promise<PaginaMovimientos>;
  guardar(movimiento: Movimiento): Promise<Movimiento>;
  actualizar(movimiento: Movimiento): Promise<Movimiento>;
}
