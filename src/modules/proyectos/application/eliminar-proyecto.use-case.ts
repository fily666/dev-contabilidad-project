import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { ProyectoRepository } from "../domain/proyecto.repository";

/**
 * RF-18: solo se elimina un proyecto sin movimientos.
 * Con movimientos, la unica opcion es archivarlo (trazabilidad, ADR-12).
 */
export class EliminarProyecto {
  constructor(private readonly proyectos: ProyectoRepository) {}

  async ejecutar(entrada: { id: string; propietarioId: string }): Promise<void> {
    const proyecto = await this.proyectos.buscarPorId(entrada.id, entrada.propietarioId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.id);

    const movimientos = await this.proyectos.contarMovimientos(entrada.id, entrada.propietarioId);
    if (movimientos > 0) {
      throw new ReglaDeNegocioViolada(
        "PROYECTO_CON_MOVIMIENTOS",
        `El proyecto tiene ${movimientos} movimiento(s) registrado(s): solo puede archivarse.`,
      );
    }

    await this.proyectos.eliminar(entrada.id, entrada.propietarioId);
  }
}
