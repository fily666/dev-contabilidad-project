import { NoEncontrado } from "@/shared/domain/errores";
import type { Reloj } from "@/shared/domain/reloj";
import type { ObligacionRepository } from "@/modules/obligaciones/domain/obligacion.repository";

import {
  Notificacion,
  type CanalNotificacion,
  type EstadoNotificacion,
} from "../domain/notificacion.entity";
import type {
  NotificacionListada,
  NotificacionRepository,
  NotificadorEmail,
  NotificadorWhatsApp,
} from "../domain/notificacion.repository";
import { plantillaAviso, plantillaResumen, type DatosAviso } from "../domain/plantillas";

/** Casos de uso de notificaciones (Contexto.md §10, RF-53, RF-102). */

export type ConfiguracionAvisos = {
  canales: CanalNotificacion[];
  /** Días de anticipación por omisión cuando la obligación no los define. */
  diasAviso: number[];
  /** Destinatario del correo; sin él, el canal email no se programa. */
  emailDestino: string | null;
  /** RF-102, §17 P-3: destinatario de WhatsApp; sin él, el canal no se programa. */
  whatsappDestino: string | null;
  urlBase: string;
};

/**
 * RF-53 y §10.1: programa los avisos de cada ocurrencia según sus días de aviso.
 *
 * Idempotente: el instante programado se deriva de la fecha de vencimiento y de
 * los días de anticipación, así que dos ejecuciones el mismo día producen la
 * misma clave y el repositorio descarta la segunda (§6.3).
 */
export class ProgramarAvisos {
  constructor(
    private readonly notificaciones: NotificacionRepository,
    private readonly obligaciones: ObligacionRepository,
    private readonly reloj: Reloj,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: {
    configuracion: ConfiguracionAvisos;
    /** Ventana de búsqueda hacia adelante; por omisión 90 días. */
    dentroDeDias?: number;
  }): Promise<{ programados: number; omitidos: number }> {
    const { configuracion } = entrada;
    const canales = configuracion.canales.filter((canal) => {
      if (canal === "email") return configuracion.emailDestino !== null;
      if (canal === "whatsapp") return configuracion.whatsappDestino !== null;
      return true;
    });

    if (canales.length === 0) return { programados: 0, omitidos: 0 };

    const agenda = await this.obligaciones.listarAgenda({
      dentroDeDias: entrada.dentroDeDias ?? 90,
      incluirVencidas: true,
    });

    let programados = 0;
    let omitidos = 0;

    for (const evento of agenda) {
      const obligacion = await this.obligaciones.buscarPorId(evento.obligacionId);
      const dias = obligacion?.diasAviso.length ? obligacion.diasAviso : configuracion.diasAviso;

      for (const anticipacion of dias) {
        // Un aviso cuyo instante ya pasó no se programa hacia atrás; el vencido
        // se cubre con el aviso de cero días, que cae el mismo día del
        // vencimiento.
        if (evento.diasRestantes < 0 && anticipacion > 0) continue;
        if (evento.diasRestantes > 0 && anticipacion > evento.diasRestantes) continue;

        const instante = instanteDeAviso(evento.fechaVencimiento, anticipacion);
        const datos: DatosAviso = {
          proyecto: evento.proyectoNombre,
          concepto: evento.concepto,
          valorEstimado: evento.valorEstimado,
          moneda: evento.moneda,
          fechaVencimiento: evento.fechaVencimiento,
          diasRestantes: evento.diasRestantes,
          enlace: `${configuracion.urlBase}/obligaciones`,
        };
        const plantilla = plantillaAviso(datos);

        for (const canal of canales) {
          const creada = await this.notificaciones.programarSiFalta(
            Notificacion.programar({
              id: this.nuevoId(),
              ocurrenciaId: evento.ocurrenciaId,
              canal,
              asunto: plantilla.asunto,
              cuerpo: canal === "email" ? plantilla.html : plantilla.texto,
              programadaPara: instante,
            }),
          );

          if (creada) programados += 1;
          else omitidos += 1;
        }
      }
    }

    return { programados, omitidos };
  }

  /** §10.3: resumen semanal, programado para el instante indicado. */
  async programarResumen(entrada: {
    configuracion: ConfiguracionAvisos;
    dentroDeDias?: number;
  }): Promise<{ programado: boolean }> {
    if (entrada.configuracion.emailDestino === null) return { programado: false };

    const agenda = await this.obligaciones.listarAgenda({
      dentroDeDias: entrada.dentroDeDias ?? 7,
      incluirVencidas: true,
    });
    if (agenda.length === 0) return { programado: false };

    const plantilla = plantillaResumen({
      enlace: `${entrada.configuracion.urlBase}/calendario`,
      eventos: agenda.map((evento) => ({
        proyecto: evento.proyectoNombre,
        concepto: evento.concepto,
        valorEstimado: evento.valorEstimado,
        moneda: evento.moneda,
        fechaVencimiento: evento.fechaVencimiento,
        diasRestantes: evento.diasRestantes,
        enlace: `${entrada.configuracion.urlBase}/obligaciones`,
      })),
    });

    const creada = await this.notificaciones.programarSiFalta(
      Notificacion.programar({
        id: this.nuevoId(),
        // Sin ocurrencia: el resumen no pertenece a un vencimiento concreto. Su
        // unicidad la da el instante, que es el mismo para todo el dia, y desde
        // que el indice de §6.3 es `nulls not distinct` la base la hace cumplir
        // en lugar de confiar en que no coincida.
        ocurrenciaId: null,
        canal: "email",
        asunto: plantilla.asunto,
        cuerpo: plantilla.html,
        programadaPara: `${this.reloj.hoy()}T12:00:00.000Z`,
      }),
    );

    return { programado: creada };
  }
}

/** §10.1: envía la cola, marca enviadas y reintenta las fallidas (máx. 3). */
export class EnviarNotificaciones {
  constructor(
    private readonly notificaciones: NotificacionRepository,
    private readonly email: NotificadorEmail,
    private readonly reloj: Reloj,
    private readonly whatsapp?: NotificadorWhatsApp,
  ) {}

  async ejecutar(entrada: {
    emailDestino: string | null;
    whatsappDestino?: string | null;
    limite?: number;
  }): Promise<{ enviadas: number; fallidas: number; omitidas: number }> {
    const pendientes = await this.notificaciones.pendientesDeEnvio(
      this.reloj.ahora(),
      entrada.limite ?? 50,
    );

    let enviadas = 0;
    let fallidas = 0;
    let omitidas = 0;

    for (const notificacion of pendientes) {
      try {
        if (notificacion.canal === "email") {
          if (!entrada.emailDestino) {
            omitidas += 1;
            continue;
          }
          await this.email.enviar({
            para: entrada.emailDestino,
            asunto: notificacion.asunto,
            html: notificacion.cuerpo,
            texto: notificacion.cuerpo.replace(/<[^>]+>/g, " "),
          });
        } else if (notificacion.canal === "whatsapp") {
          if (!this.whatsapp || !entrada.whatsappDestino) {
            // Sin adaptador configurado, o sin numero de destino en ajustes, se
            // deja programada en lugar de marcarla fallida: el mensaje no se ha
            // perdido, todavia no hay por donde enviarlo (§10.2).
            omitidas += 1;
            continue;
          }
          await this.whatsapp.enviar({
            para: entrada.whatsappDestino,
            texto: notificacion.cuerpo,
          });
        } else {
          // in_app: la campana la lee de la tabla; publicarla es marcarla enviada.
        }

        notificacion.marcarEnviada(this.reloj.ahora());
        await this.notificaciones.actualizar(notificacion);
        enviadas += 1;
      } catch (error) {
        notificacion.marcarFallida(error instanceof Error ? error.message : String(error));
        await this.notificaciones.actualizar(notificacion);
        fallidas += 1;
      }
    }

    return { enviadas, fallidas, omitidas };
  }
}

/**
 * Historial completo de avisos (§10.2, RF-59): todos los canales y estados, para
 * la pantalla que responde «¿se envió o no?». La campana no usa este caso de uso
 * sino `ObtenerBandejaAvisos`, porque son dos preguntas distintas: aquí interesa
 * el envío, allí lo que queda por ver.
 */
export class ListarNotificaciones {
  constructor(private readonly notificaciones: NotificacionRepository) {}

  async ejecutar(
    entrada: {
      limite?: number;
      estados?: EstadoNotificacion[];
      canal?: CanalNotificacion;
    } = {},
  ): Promise<NotificacionListada[]> {
    return this.notificaciones.listar({
      limite: entrada.limite ?? 20,
      estados: entrada.estados,
      canal: entrada.canal,
    });
  }
}

/**
 * Bandeja de la campana (§10.2, RF-59).
 *
 * Devuelve las dos cosas juntas porque la campana necesita las dos y en una sola
 * navegación: el contador para la insignia y los últimos avisos para el panel.
 * El conteo no se deriva de la lista —la lista viene recortada por `limite`, y
 * «9 sin leer» con ocho filas visibles es correcto, mientras que contar las
 * visibles daría ocho y mentiría—.
 */
export class ObtenerBandejaAvisos {
  constructor(
    private readonly notificaciones: NotificacionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(
    entrada: { limite?: number; soloNoLeidos?: boolean } = {},
  ): Promise<{ avisos: NotificacionListada[]; noLeidos: number }> {
    const ahora = this.reloj.ahora();

    const [avisos, noLeidos] = await Promise.all([
      this.notificaciones.bandeja(ahora, {
        limite: entrada.limite ?? 10,
        soloNoLeidos: entrada.soloNoLeidos,
      }),
      this.notificaciones.contarNoLeidos(ahora),
    ]);

    return { avisos, noLeidos };
  }
}

/** §10.2: el dueño vio un aviso concreto. */
export class MarcarAvisoLeido {
  constructor(
    private readonly notificaciones: NotificacionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(entrada: { id: string }): Promise<{ id: string }> {
    const aviso = await this.notificaciones.buscarPorId(entrada.id);
    if (!aviso) throw new NoEncontrado("aviso", entrada.id);

    // La regla del canal vive en la entidad, no aquí (§7.4).
    aviso.marcarLeida(this.reloj.ahora());
    await this.notificaciones.actualizar(aviso);

    return { id: aviso.id };
  }
}

/** §10.2: «marcar todo como leído». Ver por qué es una operación de conjunto en el puerto. */
export class MarcarAvisosLeidos {
  constructor(
    private readonly notificaciones: NotificacionRepository,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(): Promise<{ leidos: number }> {
    return { leidos: await this.notificaciones.marcarTodosLeidos(this.reloj.ahora()) };
  }
}

/**
 * El instante del aviso: mediodía UTC del día que toca. A las 07:00 en Bogotá,
 * que es cuando un aviso sirve; programarlo a medianoche lo dejaría enterrado
 * bajo el correo de la mañana.
 */
function instanteDeAviso(fechaVencimiento: string, diasAntes: number): string {
  const [anio, mes, dia] = fechaVencimiento.split("-").map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia - diasAntes, 12, 0, 0));
  return fecha.toISOString();
}
