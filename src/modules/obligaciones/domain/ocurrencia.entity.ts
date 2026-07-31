import { ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { EstadoOcurrencia } from "@/shared/domain/enumeraciones";
import type { FechaIso } from "@/shared/domain/reloj";

export type DatosOcurrencia = {
  id: string;
  obligacionId: string;
  fechaVencimiento: FechaIso;
  valorEstimado: number;
  estado: EstadoOcurrencia;
  /** Movimiento que la ejecuto, si ya se pago (RF-54). */
  movimientoId: string | null;
};

/**
 * Ocurrencia materializada de una obligacion (Contexto.md ADR-08, RF-55).
 *
 * Se materializa en lugar de calcularse al vuelo para que calendario,
 * notificaciones y proyeccion sean consultables y filtrables por SQL.
 */
export class Ocurrencia {
  private constructor(private datos: DatosOcurrencia) {}

  static desdePersistencia(datos: DatosOcurrencia): Ocurrencia {
    return new Ocurrencia(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get obligacionId(): string {
    return this.datos.obligacionId;
  }
  get fechaVencimiento(): FechaIso {
    return this.datos.fechaVencimiento;
  }
  get valorEstimado(): number {
    return this.datos.valorEstimado;
  }
  get estado(): EstadoOcurrencia {
    return this.datos.estado;
  }
  get movimientoId(): string | null {
    return this.datos.movimientoId;
  }

  /**
   * RF-55: una pendiente cuya fecha ya paso se presenta como vencida aunque la
   * tarea diaria todavia no haya corrido (§10.1).
   */
  estadoEfectivo(hoy: FechaIso): EstadoOcurrencia {
    if (this.datos.estado === "pendiente" && this.datos.fechaVencimiento < hoy) return "vencida";
    return this.datos.estado;
  }

  /** RF-54: el pago lo ejecuta un movimiento; aqui solo se anota el vinculo. */
  registrarPago(movimientoId: string): void {
    this.exigirAbierta("pagar");
    this.datos.estado = "pagada";
    this.datos.movimientoId = movimientoId;
  }

  /** RF-56: omitir no afecta a las siguientes ocurrencias. */
  omitir(): void {
    this.exigirAbierta("omitir");
    this.datos.estado = "omitida";
  }

  /** Deshacer una omision: vuelve a la cola de pendientes. */
  reactivar(): void {
    if (this.datos.estado === "pagada") {
      throw new ReglaDeNegocioViolada(
        "OCURRENCIA_YA_PAGADA",
        "La ocurrencia ya esta pagada: anula el movimiento asociado si fue un error.",
      );
    }
    this.datos.estado = "pendiente";
    this.datos.movimientoId = null;
  }

  aDatos(): DatosOcurrencia {
    return { ...this.datos };
  }

  private exigirAbierta(accion: string): void {
    if (this.datos.estado === "pagada") {
      throw new ReglaDeNegocioViolada(
        "OCURRENCIA_YA_PAGADA",
        `La ocurrencia ya esta pagada y no se puede ${accion}.`,
      );
    }
    if (this.datos.estado === "omitida" && accion === "omitir") {
      throw new ReglaDeNegocioViolada("OCURRENCIA_OMITIDA", "La ocurrencia ya esta omitida.");
    }
  }
}
