import { ReglaDeNegocioViolada } from "@/shared/domain/errores";

/** §6.2. */
export const CANALES_NOTIFICACION = ["email", "whatsapp", "in_app"] as const;
export type CanalNotificacion = (typeof CANALES_NOTIFICACION)[number];

export const ESTADOS_NOTIFICACION = ["programada", "enviada", "fallida", "cancelada"] as const;
export type EstadoNotificacion = (typeof ESTADOS_NOTIFICACION)[number];

/** §10.1: máximo tres intentos antes de darla por perdida. */
export const INTENTOS_MAXIMOS = 3;

export type DatosNotificacion = {
  id: string;
  ocurrenciaId: string | null;
  canal: CanalNotificacion;
  asunto: string;
  cuerpo: string;
  /** Instante ISO en el que corresponde enviarla. */
  programadaPara: string;
  enviadaEn: string | null;
  estado: EstadoNotificacion;
  error: string | null;
  intentos: number;
  /**
   * Instante en que el dueño vio el aviso en la campana; null si no lo ha visto
   * (§10.2). Eje distinto de `estado`: ese describe el envío, este la lectura.
   */
  leidaEn: string | null;
};

/**
 * Notificación programada (Contexto.md §10, RF-53).
 *
 * Se materializa en una fila antes de enviarse, por la misma razón que las
 * ocurrencias (ADR-08): así el envío es idempotente —el índice único de §6.3
 * impide programar dos veces el mismo aviso— y un fallo de red se puede
 * reintentar sin volver a calcular a quién había que avisar.
 */
export class Notificacion {
  private constructor(private datos: DatosNotificacion) {}

  static programar(entrada: {
    id: string;
    ocurrenciaId?: string | null;
    canal: CanalNotificacion;
    asunto: string;
    cuerpo: string;
    programadaPara: string;
  }): Notificacion {
    if (entrada.asunto.trim().length < 1) {
      throw new ReglaDeNegocioViolada("ASUNTO_REQUERIDO", "La notificación necesita un asunto.");
    }

    return new Notificacion({
      id: entrada.id,
      ocurrenciaId: entrada.ocurrenciaId ?? null,
      canal: entrada.canal,
      asunto: entrada.asunto.trim(),
      cuerpo: entrada.cuerpo,
      programadaPara: entrada.programadaPara,
      enviadaEn: null,
      estado: "programada",
      error: null,
      intentos: 0,
      leidaEn: null,
    });
  }

  static desdePersistencia(datos: DatosNotificacion): Notificacion {
    return new Notificacion(datos);
  }

  get id(): string {
    return this.datos.id;
  }
  get canal(): CanalNotificacion {
    return this.datos.canal;
  }
  get asunto(): string {
    return this.datos.asunto;
  }
  get cuerpo(): string {
    return this.datos.cuerpo;
  }
  get estado(): EstadoNotificacion {
    return this.datos.estado;
  }
  get intentos(): number {
    return this.datos.intentos;
  }
  get programadaPara(): string {
    return this.datos.programadaPara;
  }
  get leidaEn(): string | null {
    return this.datos.leidaEn;
  }

  /** ¿Toca enviarla ya? */
  vencida(ahora: Date): boolean {
    return (
      (this.datos.estado === "programada" || this.datos.estado === "fallida") &&
      Date.parse(this.datos.programadaPara) <= ahora.getTime() &&
      this.datos.intentos < INTENTOS_MAXIMOS
    );
  }

  /**
   * ¿Se muestra en la campana? (§10.2, RF-59.)
   *
   * Desde que su instante se cumple, no desde que la tarea horaria la marca
   * `enviada`: el aviso in-app no tiene proveedor al que esperar, y esperar a la
   * tarea lo retrasaría hasta una hora. Las canceladas quedan fuera, que es lo
   * que hace que pagar una obligación limpie sus avisos sin código extra
   * (`cancelarDeOcurrencia`).
   */
  publicada(ahora: Date): boolean {
    return (
      this.datos.canal === "in_app" &&
      this.datos.estado !== "cancelada" &&
      Date.parse(this.datos.programadaPara) <= ahora.getTime()
    );
  }

  /**
   * §10.2: marcar el aviso como visto. Idempotente —volver a leer no mueve el
   * instante— y limitado al canal in-app, igual que la restricción de la base:
   * un correo se lee en el cliente de correo y de eso aquí no se puede saber
   * nada, así que anotarlo sería inventar un dato.
   */
  marcarLeida(ahora: Date): void {
    if (this.datos.canal !== "in_app") {
      throw new ReglaDeNegocioViolada(
        "AVISO_NO_LEIBLE",
        "Solo los avisos in-app se leen dentro de la aplicación.",
      );
    }
    if (this.datos.leidaEn !== null) return;

    this.datos.leidaEn = ahora.toISOString();
  }

  marcarEnviada(ahora: Date): void {
    this.datos.estado = "enviada";
    this.datos.enviadaEn = ahora.toISOString();
    this.datos.intentos += 1;
    this.datos.error = null;
  }

  /** Al tercer fallo se cancela: reintentar para siempre solo llena la cola. */
  marcarFallida(motivo: string): void {
    this.datos.intentos += 1;
    this.datos.error = motivo.slice(0, 500);
    this.datos.estado = this.datos.intentos >= INTENTOS_MAXIMOS ? "cancelada" : "fallida";
  }

  cancelar(): void {
    this.datos.estado = "cancelada";
  }

  aDatos(): DatosNotificacion {
    return { ...this.datos };
  }
}
