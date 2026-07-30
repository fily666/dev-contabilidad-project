import type { TipoProyecto } from "../domain/tipo-proyecto.entity";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";

/** RF-11, RF-100. */
export class ListarTiposProyecto {
  constructor(private readonly tipos: TipoProyectoRepository) {}

  async ejecutar(): Promise<TipoProyecto[]> {
    return this.tipos.listar();
  }
}
