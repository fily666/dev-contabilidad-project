import type { EstadoProyecto } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";
import type { Proyecto } from "./proyecto.entity";
import type { CifrasProyecto } from "./indicadores";

/** PUERTO. El adaptador vive en infrastructure (Contexto.md §7.3). */

export type FiltroProyectos = {
  estados?: EstadoProyecto[];
  tipoProyectoId?: string;
  texto?: string;
};

export type ResumenProyecto = {
  proyectoId: string;
  nombre: string;
  /** Necesario para acotar el catalogo de categorias al tipo del proyecto. */
  tipoProyectoId: string;
  tipoCodigo: string;
  tipoNombre: string;
  icono: string | null;
  estado: EstadoProyecto;
  fechaInicio: FechaIso;
  moneda: string;
  totalInvertido: number;
  totalIngresos: number;
  totalEgresos: number;
  balance: number;
  ultimoMovimiento: FechaIso | null;
};

export interface ProyectoRepository {
  buscarPorId(id: string): Promise<Proyecto | null>;
  listar(filtro?: FiltroProyectos): Promise<ResumenProyecto[]>;
  guardar(proyecto: Proyecto): Promise<Proyecto>;
  actualizar(proyecto: Proyecto): Promise<Proyecto>;
  eliminar(id: string): Promise<void>;
  contarMovimientos(proyectoId: string): Promise<number>;
  /** Insumos agregados para calcular los indicadores de §5. */
  obtenerCifras(proyectoId: string, hoy: FechaIso): Promise<CifrasProyecto>;
}
