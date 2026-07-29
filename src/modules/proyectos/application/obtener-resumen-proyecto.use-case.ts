import { NoEncontrado } from "@/shared/domain/errores";
import type { Reloj } from "@/shared/domain/reloj";
import { calcularIndicadores, type Indicadores } from "../domain/indicadores";
import type { Proyecto } from "../domain/proyecto.entity";
import type { ProyectoRepository } from "../domain/proyecto.repository";
import type { TipoProyecto } from "../domain/tipo-proyecto.entity";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";

export type ResumenFinancieroProyecto = {
  proyecto: Proyecto;
  tipo: TipoProyecto;
  indicadores: Indicadores;
  /** Claves de indicadores que este tipo de proyecto debe mostrar (§5.4). */
  indicadoresVisibles: string[];
};

/** RF-15, RF-77 y fórmulas de §5. */
export class ObtenerResumenProyecto {
  constructor(
    private readonly proyectos: ProyectoRepository,
    private readonly tipos: TipoProyectoRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: {
    proyectoId: string;
    propietarioId: string;
  }): Promise<ResumenFinancieroProyecto> {
    const proyecto = await this.proyectos.buscarPorId(entrada.proyectoId, entrada.propietarioId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.proyectoId);

    const tipo = await this.tipos.buscarPorId(proyecto.tipoProyectoId, entrada.propietarioId);
    if (!tipo) throw new NoEncontrado("tipo de proyecto", proyecto.tipoProyectoId);

    const cifras = await this.proyectos.obtenerCifras(
      entrada.proyectoId,
      entrada.propietarioId,
      this.reloj.hoy(),
    );

    return {
      proyecto,
      tipo,
      indicadores: calcularIndicadores(cifras),
      indicadoresVisibles: tipo.configuracion.indicadores,
    };
  }
}
