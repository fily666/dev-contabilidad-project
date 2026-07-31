import type { TipoProyecto } from "./tipo-proyecto.entity";

/** PUERTO (Contexto.md §7.3). */
export interface TipoProyectoRepository {
  /** Tipos del sistema mas los propios del usuario. */
  listar(): Promise<TipoProyecto[]>;
  /** RF-100: incluye los ocultos, para poder reactivarlos. */
  listarTodos(): Promise<TipoProyecto[]>;
  buscarPorId(id: string): Promise<TipoProyecto | null>;
  buscarPorCodigo(codigo: string): Promise<TipoProyecto | null>;
  guardar(tipo: TipoProyecto): Promise<TipoProyecto>;
  actualizar(tipo: TipoProyecto): Promise<TipoProyecto>;
  eliminar(id: string): Promise<void>;
  /** Un tipo con proyectos no se elimina: se oculta (misma regla que RF-18). */
  contarProyectos(tipoProyectoId: string): Promise<number>;
}
