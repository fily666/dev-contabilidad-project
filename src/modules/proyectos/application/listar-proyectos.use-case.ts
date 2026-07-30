import type {
  FiltroProyectos,
  ProyectoRepository,
  ResumenProyecto,
} from "../domain/proyecto.repository";

/** RF-10, RF-77: listado con resumen financiero por proyecto. */
export class ListarProyectos {
  constructor(private readonly proyectos: ProyectoRepository) {}

  async ejecutar(entrada: { filtro?: FiltroProyectos }): Promise<ResumenProyecto[]> {
    return this.proyectos.listar(entrada.filtro);
  }
}
