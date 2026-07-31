import type { FechaIso, Reloj } from "@/shared/domain/reloj";

/**
 * Reloj determinista para las pruebas de casos de uso (Contexto.md §8.8).
 *
 * Vive fuera de `infrastructure/` a proposito: las pruebas de la capa de
 * aplicacion no pueden importar adaptadores sin romper las reglas de frontera
 * de §7.1, y esto no es un adaptador sino un doble.
 */
export class RelojFijo implements Reloj {
  constructor(private fecha: FechaIso = "2026-07-30") {}

  ahora(): Date {
    return new Date(`${this.fecha}T12:00:00.000Z`);
  }

  hoy(): FechaIso {
    return this.fecha;
  }

  /** Permite mover el tiempo dentro de una prueba (vencimientos, recurrencias). */
  viajarA(fecha: FechaIso): void {
    this.fecha = fecha;
  }
}
