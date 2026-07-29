import type { TipoProyecto } from "./tipo-proyecto.entity";

/** PUERTO (Contexto.md §7.3). */
export interface TipoProyectoRepository {
  /** Tipos del sistema mas los propios del usuario. */
  listar(propietarioId: string): Promise<TipoProyecto[]>;
  buscarPorId(id: string, propietarioId: string): Promise<TipoProyecto | null>;
  buscarPorCodigo(codigo: string, propietarioId: string): Promise<TipoProyecto | null>;
}
