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
  buscarPorId(id: string, propietarioId: string): Promise<Proyecto | null>;
  listar(propietarioId: string, filtro?: FiltroProyectos): Promise<ResumenProyecto[]>;
  guardar(proyecto: Proyecto, actorId: string): Promise<Proyecto>;
  actualizar(proyecto: Proyecto, actorId: string): Promise<Proyecto>;
  eliminar(id: string, propietarioId: string): Promise<void>;
  contarMovimientos(proyectoId: string, propietarioId: string): Promise<number>;
  /** Insumos agregados para calcular los indicadores de §5. */
  obtenerCifras(proyectoId: string, propietarioId: string, hoy: FechaIso): Promise<CifrasProyecto>;
}
