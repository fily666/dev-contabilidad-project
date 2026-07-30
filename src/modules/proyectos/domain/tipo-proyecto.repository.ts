import type { TipoProyecto } from "./tipo-proyecto.entity";

/** PUERTO (Contexto.md §7.3). */
export interface TipoProyectoRepository {
  /** Tipos del sistema mas los propios del usuario. */
  listar(): Promise<TipoProyecto[]>;
  buscarPorId(id: string): Promise<TipoProyecto | null>;
  buscarPorCodigo(codigo: string): Promise<TipoProyecto | null>;
}
