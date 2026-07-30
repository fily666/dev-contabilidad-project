import { NoEncontrado } from "@/shared/domain/errores";
import type { Proyecto } from "../domain/proyecto.entity";
import type { ProyectoRepository } from "../domain/proyecto.repository";

/**
 * RF-15: un proyecto por su id, sin las cifras del resumen.
 *
 * Existe para que las paginas que solo necesitan la cabecera del proyecto (la de
 * edicion y la de movimientos del proyecto) no tengan que hablar con el
 * repositorio: la presentacion invoca casos de uso, no adaptadores (§7.1.4).
 */
export class ObtenerProyecto {
  constructor(private readonly proyectos: ProyectoRepository) {}

  async ejecutar(entrada: { id: string }): Promise<Proyecto> {
    const proyecto = await this.proyectos.buscarPorId(entrada.id);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.id);
    return proyecto;
  }

  /** Variante para las paginas: `null` en lugar de excepcion, para `notFound()`. */
  async buscar(entrada: { id: string }): Promise<Proyecto | null> {
    return this.proyectos.buscarPorId(entrada.id);
  }
}
