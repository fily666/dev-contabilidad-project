import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Reloj, FechaIso } from "@/shared/domain/reloj";
import { Proyecto } from "../domain/proyecto.entity";
import type { ProyectoRepository } from "../domain/proyecto.repository";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";

export type EntradaCrearProyecto = {
  propietarioId: string;
  tipoProyectoId: string;
  nombre: string;
  descripcion?: string | null;
  /** Si se omite, se usa la fecha de negocio de hoy en la zona del perfil (§8.5). */
  fechaInicio?: FechaIso;
  fechaFin?: FechaIso | null;
  moneda?: string;
  atributos?: Record<string, unknown>;
};

/** RF-10, RF-11, RF-12, RF-14. */
export class CrearProyecto {
  constructor(
    private readonly proyectos: ProyectoRepository,
    private readonly tipos: TipoProyectoRepository,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: EntradaCrearProyecto): Promise<Proyecto> {
    const tipo = await this.tipos.buscarPorId(entrada.tipoProyectoId, entrada.propietarioId);
    if (!tipo) {
      throw new ReglaDeNegocioViolada(
        "TIPO_PROYECTO_NO_ENCONTRADO",
        "El tipo de proyecto no existe.",
        "tipoProyectoId",
      );
    }

    const proyecto = Proyecto.crear({
      id: this.nuevoId(),
      propietarioId: entrada.propietarioId,
      tipo,
      nombre: entrada.nombre,
      descripcion: entrada.descripcion,
      fechaInicio: entrada.fechaInicio ?? this.reloj.hoy(),
      fechaFin: entrada.fechaFin,
      moneda: entrada.moneda,
      atributos: entrada.atributos,
    });

    return this.proyectos.guardar(proyecto, entrada.propietarioId);
  }
}
