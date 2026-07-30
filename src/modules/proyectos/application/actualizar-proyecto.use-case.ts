import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { FechaIso } from "@/shared/domain/reloj";
import type { Proyecto } from "../domain/proyecto.entity";
import type { ProyectoRepository } from "../domain/proyecto.repository";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";

export type EntradaActualizarProyecto = {
  id: string;
  tipoProyectoId: string;
  nombre: string;
  descripcion?: string | null;
  fechaInicio: FechaIso;
  fechaFin?: FechaIso | null;
  atributos?: Record<string, unknown>;
};

/** RF-10, RF-12, RF-14. */
export class ActualizarProyecto {
  constructor(
    private readonly proyectos: ProyectoRepository,
    private readonly tipos: TipoProyectoRepository,
  ) {}

  async ejecutar(entrada: EntradaActualizarProyecto): Promise<Proyecto> {
    const proyecto = await this.proyectos.buscarPorId(entrada.id);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.id);

    const tipo = await this.tipos.buscarPorId(entrada.tipoProyectoId);
    if (!tipo) {
      throw new ReglaDeNegocioViolada(
        "TIPO_PROYECTO_NO_ENCONTRADO",
        "El tipo de proyecto no existe.",
        "tipoProyectoId",
      );
    }

    proyecto.actualizar({
      tipo,
      nombre: entrada.nombre,
      descripcion: entrada.descripcion,
      fechaInicio: entrada.fechaInicio,
      fechaFin: entrada.fechaFin,
      atributos: entrada.atributos,
    });

    return this.proyectos.actualizar(proyecto);
  }
}
