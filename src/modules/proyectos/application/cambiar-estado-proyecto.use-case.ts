import { NoEncontrado } from "@/shared/domain/errores";
import type { EstadoProyecto } from "@/shared/domain/enumeraciones";
import type { Reloj } from "@/shared/domain/reloj";
import type { Proyecto } from "../domain/proyecto.entity";
import type { ProyectoRepository } from "../domain/proyecto.repository";

/** RF-13: activar, pausar, finalizar o archivar un proyecto. */
export class CambiarEstadoProyecto {
  constructor(
    private readonly proyectos: ProyectoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: {
    id: string;
    propietarioId: string;
    estado: EstadoProyecto;
  }): Promise<Proyecto> {
    const proyecto = await this.proyectos.buscarPorId(entrada.id, entrada.propietarioId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.id);

    proyecto.cambiarEstado(entrada.estado, this.reloj.hoy());
    return this.proyectos.actualizar(proyecto, entrada.propietarioId);
  }
}
