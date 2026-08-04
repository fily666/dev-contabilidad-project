import type { Notificacion } from "../domain/notificacion.entity";
import type {
  NotificacionListada,
  NotificacionRepository,
  NotificadorEmail,
  NotificadorWhatsApp,
} from "../domain/notificacion.repository";

/** Dobles en memoria de los puertos de notificaciones (Contexto.md §8.8). */

function aListada(notificacion: Notificacion): NotificacionListada {
  const d = notificacion.aDatos();
  return {
    id: d.id,
    ocurrenciaId: d.ocurrenciaId,
    canal: d.canal,
    asunto: d.asunto,
    cuerpo: d.cuerpo,
    programadaPara: d.programadaPara,
    enviadaEn: d.enviadaEn,
    estado: d.estado,
    intentos: d.intentos,
    error: d.error,
    leidaEn: d.leidaEn,
  };
}

export class NotificacionRepositoryEnMemoria implements NotificacionRepository {
  readonly filas = new Map<string, Notificacion>();
  /** Claves ya programadas: reproduce el indice unico de §6.3. */
  private readonly claves = new Set<string>();

  async pendientesDeEnvio(ahora: Date, limite = 50): Promise<Notificacion[]> {
    return [...this.filas.values()]
      .filter((n) => n.vencida(ahora))
      .sort((a, b) => a.programadaPara.localeCompare(b.programadaPara))
      .slice(0, limite);
  }

  async listar(
    filtro: { estados?: NotificacionListada["estado"][]; limite?: number } = {},
  ): Promise<NotificacionListada[]> {
    return [...this.filas.values()]
      .map(aListada)
      .filter((n) => !filtro.estados?.length || filtro.estados.includes(n.estado))
      .slice(0, filtro.limite ?? 20);
  }

  async buscarPorId(id: string): Promise<Notificacion | null> {
    return this.filas.get(id) ?? null;
  }

  /** Reproduce el indice parcial de §6.3: in-app, no cancelada, ya publicada. */
  async bandeja(
    ahora: Date,
    filtro: { soloNoLeidos?: boolean; limite?: number } = {},
  ): Promise<NotificacionListada[]> {
    return [...this.filas.values()]
      .filter((n) => n.publicada(ahora))
      .filter((n) => !filtro.soloNoLeidos || n.leidaEn === null)
      .sort((a, b) => b.programadaPara.localeCompare(a.programadaPara))
      .map(aListada)
      .slice(0, filtro.limite ?? 20);
  }

  async contarNoLeidos(ahora: Date): Promise<number> {
    return [...this.filas.values()].filter((n) => n.publicada(ahora) && n.leidaEn === null).length;
  }

  async marcarTodosLeidos(ahora: Date): Promise<number> {
    let leidos = 0;
    for (const notificacion of this.filas.values()) {
      if (notificacion.publicada(ahora) && notificacion.leidaEn === null) {
        notificacion.marcarLeida(ahora);
        leidos += 1;
      }
    }
    return leidos;
  }

  async programarSiFalta(notificacion: Notificacion): Promise<boolean> {
    const d = notificacion.aDatos();
    const clave = `${d.ocurrenciaId ?? "sin-ocurrencia"}|${d.canal}|${d.programadaPara}`;
    if (this.claves.has(clave)) return false;

    this.claves.add(clave);
    this.filas.set(d.id, notificacion);
    return true;
  }

  async actualizar(notificacion: Notificacion): Promise<Notificacion> {
    this.filas.set(notificacion.id, notificacion);
    return notificacion;
  }

  async cancelarDeOcurrencia(ocurrenciaId: string): Promise<number> {
    let canceladas = 0;
    for (const notificacion of this.filas.values()) {
      const d = notificacion.aDatos();
      if (
        d.ocurrenciaId === ocurrenciaId &&
        (d.estado === "programada" || d.estado === "fallida")
      ) {
        notificacion.cancelar();
        canceladas += 1;
      }
    }
    return canceladas;
  }
}

export class NotificadorEmailEnMemoria implements NotificadorEmail {
  enviados: Array<{ para: string; asunto: string }> = [];
  /** Cuando es true, cada envio falla: sirve para probar los reintentos. */
  falla = false;

  async enviar(mensaje: {
    para: string;
    asunto: string;
    html: string;
    texto: string;
  }): Promise<{ id: string }> {
    if (this.falla) throw new Error("proveedor no disponible");
    this.enviados.push({ para: mensaje.para, asunto: mensaje.asunto });
    return { id: `correo-${this.enviados.length}` };
  }
}

/** §17 P-3: doble del adaptador de Meta, mismo patron que el de correo. */
export class NotificadorWhatsAppEnMemoria implements NotificadorWhatsApp {
  enviados: Array<{ para: string; texto: string }> = [];
  /** Cuando es true, cada envio falla: sirve para probar los reintentos. */
  falla = false;

  async enviar(mensaje: { para: string; texto: string }): Promise<{ id: string }> {
    if (this.falla) throw new Error("proveedor no disponible");
    this.enviados.push(mensaje);
    return { id: `whatsapp-${this.enviados.length}` };
  }
}
