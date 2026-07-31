import type { CanalNotificacion, EstadoNotificacion, Notificacion } from "./notificacion.entity";

/** PUERTO `NotificacionRepository` (Contexto.md §7.3, §10). */

export type NotificacionListada = {
  id: string;
  ocurrenciaId: string | null;
  canal: CanalNotificacion;
  asunto: string;
  programadaPara: string;
  enviadaEn: string | null;
  estado: EstadoNotificacion;
  intentos: number;
  error: string | null;
};

export interface NotificacionRepository {
  /** Cola de envío: programadas o fallidas con fecha ya cumplida (§10.1). */
  pendientesDeEnvio(ahora: Date, limite?: number): Promise<Notificacion[]>;
  listar(filtro?: {
    estados?: EstadoNotificacion[];
    canal?: CanalNotificacion;
    limite?: number;
  }): Promise<NotificacionListada[]>;
  /**
   * Inserta si no existe ya el aviso (ocurrencia + canal + instante). Devuelve
   * `false` cuando ya estaba: es lo que hace idempotente la tarea diaria.
   */
  programarSiFalta(notificacion: Notificacion): Promise<boolean>;
  actualizar(notificacion: Notificacion): Promise<Notificacion>;
  /** Al pagar u omitir una ocurrencia, sus avisos dejan de tener sentido. */
  cancelarDeOcurrencia(ocurrenciaId: string): Promise<number>;
}

/** PUERTO `NotificadorEmail` (§7.3). El adaptador v1 es Resend. */
export interface NotificadorEmail {
  enviar(mensaje: {
    para: string;
    asunto: string;
    html: string;
    texto: string;
  }): Promise<{ id: string }>;
}

/**
 * PUERTO `NotificadorWhatsApp` (§7.3, Fase 5).
 *
 * Existe ya, sin adaptador real, por lo que dice §10.2: el canal se decide
 * después (pendiente 3 de §17) y el dominio no debe enterarse de cuál se eligió.
 */
export interface NotificadorWhatsApp {
  enviar(mensaje: { para: string; texto: string }): Promise<{ id: string }>;
}
