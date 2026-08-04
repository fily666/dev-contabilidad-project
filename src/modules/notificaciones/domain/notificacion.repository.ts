import type { CanalNotificacion, EstadoNotificacion, Notificacion } from "./notificacion.entity";

/** PUERTO `NotificacionRepository` (Contexto.md §7.3, §10). */

export type NotificacionListada = {
  id: string;
  ocurrenciaId: string | null;
  canal: CanalNotificacion;
  asunto: string;
  /**
   * Texto del aviso. La campana lo muestra tal cual (§10.2); en el canal in-app
   * la plantilla guarda la versión de texto plano, no el HTML del correo.
   */
  cuerpo: string;
  programadaPara: string;
  enviadaEn: string | null;
  estado: EstadoNotificacion;
  intentos: number;
  error: string | null;
  leidaEn: string | null;
};

export interface NotificacionRepository {
  /** Cola de envío: programadas o fallidas con fecha ya cumplida (§10.1). */
  pendientesDeEnvio(ahora: Date, limite?: number): Promise<Notificacion[]>;
  listar(filtro?: {
    estados?: EstadoNotificacion[];
    canal?: CanalNotificacion;
    limite?: number;
  }): Promise<NotificacionListada[]>;
  buscarPorId(id: string): Promise<Notificacion | null>;
  /**
   * Bandeja de la campana (§10.2, RF-59): avisos in-app publicados —instante
   * cumplido— y no cancelados, del más reciente al más antiguo.
   */
  bandeja(
    ahora: Date,
    filtro?: { soloNoLeidos?: boolean; limite?: number },
  ): Promise<NotificacionListada[]>;
  contarNoLeidos(ahora: Date): Promise<number>;
  /**
   * Marca leídos todos los avisos publicados de una vez.
   *
   * Es una operación de conjunto y se queda en el puerto en lugar de recorrer
   * entidades: cargar N avisos para poner la misma marca en todos es ceremonia
   * sin invariante que proteger. La lectura de UNO sí pasa por la entidad
   * (`MarcarAvisoLeido`), que es donde vive la regla del canal.
   */
  marcarTodosLeidos(ahora: Date): Promise<number>;
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
 * PUERTO `NotificadorWhatsApp` (§7.3, Fase 5). Adaptador v1: API oficial de
 * WhatsApp Business de Meta (§17 P-3, decisión cerrada).
 *
 * El dominio no se entera de cuál proveedor se eligió: solo conoce `para`
 * (E.164) y `texto`. Sin adaptador configurado en el entorno, el caso de uso
 * deja el aviso `programada` en vez de `fallida` (§10.2).
 */
export interface NotificadorWhatsApp {
  enviar(mensaje: { para: string; texto: string }): Promise<{ id: string }>;
}
