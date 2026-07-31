import type { Notificacion } from "../domain/notificacion.entity";
import type {
  NotificacionListada,
  NotificacionRepository,
  NotificadorEmail,
} from "../domain/notificacion.repository";

/** Dobles en memoria de los puertos de notificaciones (Contexto.md §8.8). */

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
      .map((n) => {
        const d = n.aDatos();
        return {
          id: d.id,
          ocurrenciaId: d.ocurrenciaId,
          canal: d.canal,
          asunto: d.asunto,
          programadaPara: d.programadaPara,
          enviadaEn: d.enviadaEn,
          estado: d.estado,
          intentos: d.intentos,
          error: d.error,
        };
      })
      .filter((n) => !filtro.estados?.length || filtro.estados.includes(n.estado))
      .slice(0, filtro.limite ?? 20);
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
