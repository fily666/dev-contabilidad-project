import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { Frecuencia } from "@/shared/domain/enumeraciones";
import type { FechaIso, Reloj } from "@/shared/domain/reloj";
import type { CategoriaRepository } from "@/modules/categorias/domain/categoria.repository";
import type { ProyectoRepository } from "@/modules/proyectos/domain/proyecto.repository";
import type { RegistrarMovimiento } from "@/modules/movimientos/application/registrar-movimiento.use-case";

import { Obligacion } from "../domain/obligacion.entity";
import type {
  EventoAgenda,
  FiltroAgenda,
  FiltroObligaciones,
  ObligacionListada,
  ObligacionRepository,
  OcurrenciaListada,
} from "../domain/obligacion.repository";
import type { Ocurrencia } from "../domain/ocurrencia.entity";
import { limiteDelHorizonte } from "../domain/recurrencia";

/** Casos de uso de obligaciones y recordatorios (Contexto.md RF-50 a RF-58). */

/** RF-50. */
export class ListarObligaciones {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(entrada: { filtro?: FiltroObligaciones } = {}): Promise<ObligacionListada[]> {
    return this.obligaciones.listar(entrada.filtro);
  }
}

/** RF-58, RF-73: vencidas y proximas a vencer. */
export class ListarAgenda {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(entrada: { filtro?: FiltroAgenda } = {}): Promise<EventoAgenda[]> {
    return this.obligaciones.listarAgenda(entrada.filtro);
  }
}

export class ListarOcurrencias {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(entrada: { obligacionId: string }): Promise<OcurrenciaListada[]> {
    return this.obligaciones.listarOcurrencias(entrada.obligacionId);
  }
}

export type EntradaCrearObligacion = {
  proyectoId: string;
  categoriaId: string;
  concepto: string;
  valorEstimado: number;
  fechaVencimiento: FechaIso;
  frecuencia: Frecuencia;
  intervaloMeses?: number | null;
  diasAviso?: number[];
  crearMovimientoAuto?: boolean;
};

/** RF-50, RF-51. */
export class CrearObligacion {
  constructor(
    private readonly obligaciones: ObligacionRepository,
    private readonly proyectos: ProyectoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: EntradaCrearObligacion): Promise<Obligacion> {
    const proyecto = await this.proyectos.buscarPorId(entrada.proyectoId);
    if (!proyecto) throw new NoEncontrado("proyecto", entrada.proyectoId);

    // Un proyecto cerrado no acepta compromisos nuevos, por la misma razon que no
    // acepta movimientos (§5.7.7).
    if (!proyecto.aceptaMovimientos()) {
      throw new ReglaDeNegocioViolada(
        "PROYECTO_CERRADO",
        "El proyecto esta finalizado o archivado y no acepta obligaciones nuevas.",
      );
    }

    const categoria = await this.categorias.buscarPorId(entrada.categoriaId);
    if (!categoria) throw new NoEncontrado("categoria", entrada.categoriaId);

    const obligacion = Obligacion.crear({
      id: this.nuevoId(),
      proyectoId: proyecto.id,
      categoriaId: categoria.id,
      concepto: entrada.concepto,
      valorEstimado: entrada.valorEstimado,
      fechaVencimiento: entrada.fechaVencimiento,
      frecuencia: entrada.frecuencia,
      intervaloMeses: entrada.intervaloMeses,
      diasAviso: entrada.diasAviso,
      crearMovimientoAuto: entrada.crearMovimientoAuto,
    });

    return this.obligaciones.guardar(obligacion);
  }
}

/** RF-50. */
export class ActualizarObligacion {
  constructor(
    private readonly obligaciones: ObligacionRepository,
    private readonly categorias: CategoriaRepository,
  ) {}

  async ejecutar(
    entrada: Omit<EntradaCrearObligacion, "proyectoId"> & { id: string },
  ): Promise<Obligacion> {
    const obligacion = await this.obligaciones.buscarPorId(entrada.id);
    if (!obligacion) throw new NoEncontrado("obligacion", entrada.id);

    const categoria = await this.categorias.buscarPorId(entrada.categoriaId);
    if (!categoria) throw new NoEncontrado("categoria", entrada.categoriaId);

    obligacion.actualizar({
      categoriaId: categoria.id,
      concepto: entrada.concepto,
      valorEstimado: entrada.valorEstimado,
      fechaVencimiento: entrada.fechaVencimiento,
      frecuencia: entrada.frecuencia,
      intervaloMeses: entrada.intervaloMeses,
      diasAviso: entrada.diasAviso,
      crearMovimientoAuto: entrada.crearMovimientoAuto,
    });

    return this.obligaciones.actualizar(obligacion);
  }
}

/** RF-57: suspender o reactivar una obligacion recurrente. */
export class CambiarEstadoObligacion {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(entrada: { id: string; activa: boolean }): Promise<Obligacion> {
    const obligacion = await this.obligaciones.buscarPorId(entrada.id);
    if (!obligacion) throw new NoEncontrado("obligacion", entrada.id);

    if (entrada.activa) obligacion.reactivar();
    else obligacion.suspender();

    return this.obligaciones.actualizar(obligacion);
  }
}

/**
 * Eliminar una obligacion. Si alguna ocurrencia ya se pago, la obligacion es
 * parte del historial y solo se suspende (ADR-12, misma regla que RF-18).
 */
export class EliminarObligacion {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(entrada: { id: string }): Promise<void> {
    const obligacion = await this.obligaciones.buscarPorId(entrada.id);
    if (!obligacion) throw new NoEncontrado("obligacion", entrada.id);

    const pagadas = await this.obligaciones.contarOcurrenciasPagadas(entrada.id);
    if (pagadas > 0) {
      throw new ReglaDeNegocioViolada(
        "OBLIGACION_CON_PAGOS",
        `La obligacion tiene ${pagadas} ocurrencia(s) pagada(s): solo puede suspenderse.`,
      );
    }

    await this.obligaciones.eliminar(entrada.id);
  }
}

/**
 * RF-52: materializa las ocurrencias del horizonte. Idempotente (§10.1): la
 * ejecuta el cron diario y tambien la creacion de una obligacion, para que la
 * primera ocurrencia aparezca sin esperar a mañana.
 */
export class GenerarOcurrencias {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(entrada: { horizonteMeses?: number } = {}): Promise<{ insertadas: number }> {
    const horizonte = Math.min(60, Math.max(1, entrada.horizonteMeses ?? 12));
    return { insertadas: await this.obligaciones.generarOcurrencias(horizonte) };
  }
}

/** RF-25, RF-55: sincroniza los estados vencidos. La ejecuta el cron (§10.1). */
export class ActualizarEstadosVencidos {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(): Promise<{ actualizados: number }> {
    return { actualizados: await this.obligaciones.marcarVencidos() };
  }
}

export type EntradaPagarOcurrencia = {
  ocurrenciaId: string;
  metodoPagoId: string;
  /** Valor real pagado; si se omite, el estimado de la ocurrencia. */
  valor?: number;
  fechaPago?: FechaIso;
  observaciones?: string | null;
};

/**
 * RF-54: registrar el pago de una ocurrencia creando el movimiento asociado.
 *
 * Delega en `RegistrarMovimiento` en lugar de escribir el movimiento a mano: las
 * invariantes del movimiento (§5.7) valen igual venga de un formulario o de una
 * obligacion, y duplicarlas aqui seria la forma mas rapida de que dejen de
 * coincidir.
 */
export class PagarOcurrencia {
  constructor(
    private readonly obligaciones: ObligacionRepository,
    private readonly categorias: CategoriaRepository,
    private readonly registrarMovimiento: RegistrarMovimiento,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: EntradaPagarOcurrencia): Promise<{
    ocurrencia: Ocurrencia;
    movimientoId: string;
  }> {
    const ocurrencia = await this.obligaciones.buscarOcurrencia(entrada.ocurrenciaId);
    if (!ocurrencia) throw new NoEncontrado("ocurrencia", entrada.ocurrenciaId);

    const obligacion = await this.obligaciones.buscarPorId(ocurrencia.obligacionId);
    if (!obligacion) throw new NoEncontrado("obligacion", ocurrencia.obligacionId);

    const categoria = await this.categorias.buscarPorId(obligacion.categoriaId);
    if (!categoria) throw new NoEncontrado("categoria", obligacion.categoriaId);

    const valor = entrada.valor ?? ocurrencia.valorEstimado;
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new ReglaDeNegocioViolada(
        "VALOR_NO_POSITIVO",
        "Indica el valor pagado: la obligacion no tenia un estimado utilizable.",
        "valor",
      );
    }

    const movimiento = await this.registrarMovimiento.ejecutar({
      proyectoId: obligacion.proyectoId,
      categoriaId: categoria.id,
      // El tipo lo decide la naturaleza de la categoria, no el usuario: es la
      // misma regla que valida el trigger de la base (§6.6).
      tipo: categoria.tipoImplicito,
      metodoPagoId: entrada.metodoPagoId,
      fecha: entrada.fechaPago ?? this.reloj.hoy(),
      fechaPago: entrada.fechaPago ?? this.reloj.hoy(),
      valor,
      descripcion: obligacion.concepto,
      observaciones: entrada.observaciones ?? null,
      estado: "pagado",
      ocurrenciaId: ocurrencia.id,
    });

    ocurrencia.registrarPago(movimiento.id);
    const actualizada = await this.obligaciones.actualizarOcurrencia(ocurrencia);

    return { ocurrencia: actualizada, movimientoId: movimiento.id };
  }
}

/** RF-56: omitir una ocurrencia sin afectar las siguientes. */
export class CambiarEstadoOcurrencia {
  constructor(private readonly obligaciones: ObligacionRepository) {}

  async ejecutar(entrada: { id: string; omitir: boolean }): Promise<Ocurrencia> {
    const ocurrencia = await this.obligaciones.buscarOcurrencia(entrada.id);
    if (!ocurrencia) throw new NoEncontrado("ocurrencia", entrada.id);

    if (entrada.omitir) ocurrencia.omitir();
    else ocurrencia.reactivar();

    return this.obligaciones.actualizarOcurrencia(ocurrencia);
  }
}

/**
 * Vista previa de los vencimientos que generaria una obligacion en el horizonte
 * configurado. Sirve al formulario para que la recurrencia no sea un acto de fe.
 */
export class PrevisualizarVencimientos {
  constructor(private readonly reloj: Reloj) {}

  ejecutar(entrada: {
    fechaVencimiento: FechaIso;
    frecuencia: Frecuencia;
    intervaloMeses?: number | null;
    horizonteMeses?: number;
  }): FechaIso[] {
    const obligacion = Obligacion.crear({
      id: "previsualizacion",
      proyectoId: "previsualizacion",
      categoriaId: "previsualizacion",
      concepto: "Previsualizacion",
      valorEstimado: 0,
      fechaVencimiento: entrada.fechaVencimiento,
      frecuencia: entrada.frecuencia,
      intervaloMeses: entrada.intervaloMeses,
    });

    return obligacion.vencimientosHasta(
      limiteDelHorizonte(this.reloj.hoy(), entrada.horizonteMeses ?? 12),
    );
  }
}
