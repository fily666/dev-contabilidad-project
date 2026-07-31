import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { FechaIso } from "@/shared/domain/reloj";
import type { ProyectoRepository } from "@/modules/proyectos/domain/proyecto.repository";

import { consolidar, retornoDelProyecto, type ConsolidadoPatrimonio } from "../domain/consolidado";
import { Pasivo, type TipoPasivo } from "../domain/pasivo.entity";
import type {
  PasivoListado,
  PasivoRepository,
  PatrimonioProyecto,
  ValoracionListada,
  ValoracionRepository,
} from "../domain/patrimonio.repository";
import { Valoracion, variacionDeValor } from "../domain/valoracion.entity";

/** Casos de uso de patrimonio (Contexto.md RF-16, RF-17, RF-78). */

export type EntradaPasivo = {
  nombre: string;
  tipo: TipoPasivo;
  montoOriginal: number;
  saldoActual?: number;
  tasaInteresEa?: number | null;
  plazoMeses?: number | null;
  valorCuota?: number | null;
  fechaDesembolso: FechaIso;
};

/** RF-17. */
export class RegistrarPasivo {
  constructor(
    private readonly pasivos: PasivoRepository,
    private readonly proyectos: ProyectoRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: EntradaPasivo & { proyectoId: string }): Promise<Pasivo> {
    const proyecto = await this.proyectos.buscarPorId(entrada.proyectoId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.proyectoId);

    return this.pasivos.guardar(
      Pasivo.crear({ ...entrada, id: this.nuevoId(), proyectoId: proyecto.id }),
    );
  }
}

export class ActualizarPasivo {
  constructor(private readonly pasivos: PasivoRepository) {}

  async ejecutar(entrada: EntradaPasivo & { id: string; saldoActual: number }): Promise<Pasivo> {
    const pasivo = await this.pasivos.buscarPorId(entrada.id);
    if (!pasivo) throw new NoEncontrado("pasivo", entrada.id);

    pasivo.actualizar(entrada);
    return this.pasivos.actualizar(pasivo);
  }
}

/** Abono a capital: baja el saldo sin tocar el monto original (RF-29). */
export class AbonarACapital {
  constructor(private readonly pasivos: PasivoRepository) {}

  async ejecutar(entrada: { id: string; valor: number }): Promise<Pasivo> {
    const pasivo = await this.pasivos.buscarPorId(entrada.id);
    if (!pasivo) throw new NoEncontrado("pasivo", entrada.id);

    pasivo.abonarACapital(entrada.valor);
    return this.pasivos.actualizar(pasivo);
  }
}

export class CambiarEstadoPasivo {
  constructor(private readonly pasivos: PasivoRepository) {}

  async ejecutar(entrada: { id: string; activo: boolean }): Promise<Pasivo> {
    const pasivo = await this.pasivos.buscarPorId(entrada.id);
    if (!pasivo) throw new NoEncontrado("pasivo", entrada.id);

    if (entrada.activo) pasivo.reactivar();
    else pasivo.cerrar();

    return this.pasivos.actualizar(pasivo);
  }
}

/** Un pasivo saldado se cierra; eliminar es para el que se registro por error. */
export class EliminarPasivo {
  constructor(private readonly pasivos: PasivoRepository) {}

  async ejecutar(entrada: { id: string }): Promise<void> {
    const pasivo = await this.pasivos.buscarPorId(entrada.id);
    if (!pasivo) throw new NoEncontrado("pasivo", entrada.id);

    if (pasivo.activo && pasivo.saldoActual > 0 && pasivo.saldoActual < pasivo.montoOriginal) {
      throw new ReglaDeNegocioViolada(
        "PASIVO_CON_HISTORIA",
        "El pasivo ya tiene abonos registrados: ciérralo en lugar de eliminarlo.",
      );
    }

    await this.pasivos.eliminar(entrada.id);
  }
}

export class ListarPasivos {
  constructor(private readonly pasivos: PasivoRepository) {}

  async ejecutar(
    entrada: { proyectoId?: string; soloActivos?: boolean } = {},
  ): Promise<PasivoListado[]> {
    return this.pasivos.listar(entrada);
  }
}

/** RF-16. */
export class RegistrarValoracion {
  constructor(
    private readonly valoraciones: ValoracionRepository,
    private readonly proyectos: ProyectoRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: {
    proyectoId: string;
    fecha: FechaIso;
    valor: number;
    fuente?: string | null;
    notas?: string | null;
  }): Promise<Valoracion> {
    const proyecto = await this.proyectos.buscarPorId(entrada.proyectoId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.proyectoId);

    // Una valoracion anterior al inicio del proyecto no significa nada y
    // ensuciaria la serie de plusvalia.
    if (entrada.fecha < proyecto.fechaInicio) {
      throw new ReglaDeNegocioViolada(
        "VALORACION_ANTERIOR_AL_INICIO",
        "La valoracion no puede ser anterior a la fecha de inicio del proyecto.",
        "fecha",
      );
    }

    return this.valoraciones.guardar(
      Valoracion.crear({ ...entrada, id: this.nuevoId(), proyectoId: proyecto.id }),
    );
  }
}

export class EliminarValoracion {
  constructor(private readonly valoraciones: ValoracionRepository) {}

  async ejecutar(entrada: { id: string }): Promise<void> {
    const valoracion = await this.valoraciones.buscarPorId(entrada.id);
    if (!valoracion) throw new NoEncontrado("valoracion", entrada.id);

    await this.valoraciones.eliminar(entrada.id);
  }
}

export class ListarValoraciones {
  constructor(private readonly valoraciones: ValoracionRepository) {}

  async ejecutar(entrada: { proyectoId?: string } = {}): Promise<{
    filas: ValoracionListada[];
    variacion: number | null;
  }> {
    const filas = await this.valoraciones.listar(entrada);
    return { filas, variacion: variacionDeValor(filas) };
  }
}

/** RF-78: activos, pasivos, patrimonio neto y retorno por proyecto. */
export class ObtenerPatrimonio {
  constructor(private readonly valoraciones: ValoracionRepository) {}

  async ejecutar(entrada: { proyectoId?: string } = {}): Promise<{
    consolidado: ConsolidadoPatrimonio;
    proyectos: Array<PatrimonioProyecto & { retorno: number | null }>;
  }> {
    const filas = await this.valoraciones.patrimonio(entrada);

    return {
      consolidado: consolidar(filas),
      proyectos: filas
        .map((fila) => ({ ...fila, retorno: retornoDelProyecto(fila) }))
        .sort((a, b) => b.patrimonioNeto - a.patrimonioNeto),
    };
  }
}
