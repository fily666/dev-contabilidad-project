import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { FechaIso } from "@/shared/domain/reloj";
import type { CategoriaRepository } from "@/modules/categorias/domain/categoria.repository";

import { resumirEjecucion, type ResumenEjecucion } from "../domain/alertas";
import { Presupuesto, periodoSiguiente } from "../domain/presupuesto.entity";
import type {
  EjecucionPresupuesto,
  FiltroPresupuestos,
  PresupuestoRepository,
} from "../domain/presupuesto.repository";

/** Casos de uso de presupuestos (Contexto.md RF-80 a RF-83). */

export type EntradaPresupuesto = {
  proyectoId?: string | null;
  categoriaId: string;
  periodoInicio: FechaIso;
  periodoFin: FechaIso;
  valorPlaneado: number;
  notas?: string | null;
};

/** RF-80. */
export class CrearPresupuesto {
  constructor(
    private readonly presupuestos: PresupuestoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: EntradaPresupuesto): Promise<Presupuesto> {
    const categoria = await this.categorias.buscarPorId(entrada.categoriaId);
    if (!categoria) throw new NoEncontrado("categoria", entrada.categoriaId);

    // Presupuestar ingresos no es presupuestar: el comparativo de RF-81 mide
    // gasto contra plan, y una categoria de ingreso no tiene nada que ejecutar.
    if (categoria.naturaleza === "ingreso") {
      throw new ReglaDeNegocioViolada(
        "CATEGORIA_NO_PRESUPUESTABLE",
        "Los presupuestos se definen sobre categorías de egreso.",
        "categoriaId",
      );
    }

    const duplicado = await this.presupuestos.existeEnPeriodo({
      proyectoId: entrada.proyectoId ?? null,
      categoriaId: entrada.categoriaId,
      periodoInicio: entrada.periodoInicio,
      periodoFin: entrada.periodoFin,
    });
    if (duplicado) {
      throw new ReglaDeNegocioViolada(
        "PRESUPUESTO_DUPLICADO",
        "Ya hay un presupuesto para esa categoría y ese periodo.",
        "categoriaId",
      );
    }

    return this.presupuestos.guardar(Presupuesto.crear({ ...entrada, id: this.nuevoId() }));
  }
}

export class ActualizarPresupuesto {
  constructor(private readonly presupuestos: PresupuestoRepository) {}

  async ejecutar(entrada: EntradaPresupuesto & { id: string }): Promise<Presupuesto> {
    const presupuesto = await this.presupuestos.buscarPorId(entrada.id);
    if (!presupuesto) throw new NoEncontrado("presupuesto", entrada.id);

    presupuesto.actualizar(entrada);
    return this.presupuestos.actualizar(presupuesto);
  }
}

export class EliminarPresupuesto {
  constructor(private readonly presupuestos: PresupuestoRepository) {}

  async ejecutar(entrada: { id: string }): Promise<void> {
    const presupuesto = await this.presupuestos.buscarPorId(entrada.id);
    if (!presupuesto) throw new NoEncontrado("presupuesto", entrada.id);

    await this.presupuestos.eliminar(entrada.id);
  }
}

/** RF-81, RF-82: comparativo con su resumen y sus alertas. */
export class ListarEjecucionPresupuestos {
  constructor(private readonly presupuestos: PresupuestoRepository) {}

  async ejecutar(entrada: { filtro?: FiltroPresupuestos } = {}): Promise<{
    filas: EjecucionPresupuesto[];
    resumen: ResumenEjecucion;
  }> {
    const filas = await this.presupuestos.listarEjecucion(entrada.filtro);
    return { filas, resumen: resumirEjecucion(filas) };
  }
}

/**
 * RF-83: copiar el presupuesto de un periodo al siguiente.
 *
 * Salta los que ya existan en el periodo destino en lugar de fallar: copiar dos
 * veces debe ser inofensivo, igual que la generacion de ocurrencias (§10.1).
 */
export class CopiarPresupuestos {
  constructor(
    private readonly presupuestos: PresupuestoRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: {
    proyectoId?: string | null;
    periodoInicio: FechaIso;
    periodoFin: FechaIso;
  }): Promise<{
    copiados: number;
    omitidos: number;
    destino: { inicio: FechaIso; fin: FechaIso };
  }> {
    const origen = await this.presupuestos.listarDePeriodo(entrada);
    if (origen.length === 0) {
      throw new ReglaDeNegocioViolada(
        "PERIODO_SIN_PRESUPUESTOS",
        "El periodo de origen no tiene presupuestos que copiar.",
      );
    }

    const destino = periodoSiguiente(entrada.periodoInicio, entrada.periodoFin);
    let copiados = 0;
    let omitidos = 0;

    for (const presupuesto of origen) {
      const existe = await this.presupuestos.existeEnPeriodo({
        proyectoId: presupuesto.proyectoId,
        categoriaId: presupuesto.categoriaId,
        periodoInicio: destino.inicio,
        periodoFin: destino.fin,
      });

      if (existe) {
        omitidos += 1;
        continue;
      }

      await this.presupuestos.guardar(
        presupuesto.copiarA({
          id: this.nuevoId(),
          periodoInicio: destino.inicio,
          periodoFin: destino.fin,
        }),
      );
      copiados += 1;
    }

    return { copiados, omitidos, destino };
  }
}
