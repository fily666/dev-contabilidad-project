import "server-only";

import type { NotificadorWhatsApp } from "@/modules/notificaciones/domain/notificacion.repository";

/**
 * ADAPTADOR del puerto NotificadorWhatsApp sobre la API oficial de WhatsApp
 * Business de Meta (Contexto.md §7.3, §10.2, §17 P-3).
 *
 * Se habla con la Graph API directamente por el mismo motivo que Resend en
 * §8.1: una sola peticion POST, sin SDK de por medio.
 *
 * Meta exige una **plantilla pre-aprobada** (`message template`) para todo
 * mensaje que la aplicacion inicia fuera de la ventana de servicio de 24h
 * abierta por el usuario — que es exactamente el caso de un aviso de
 * vencimiento. Por eso `enviar` no manda texto libre sino una plantilla con
 * una unica variable de cuerpo: el texto del aviso. La plantilla se crea y se
 * aprueba una vez en Meta Business Manager; su nombre e idioma se configuran
 * por entorno para no acoplar el dominio a esa decision (§15.1).
 *
 * Sin `WHATSAPP_TOKEN_ACCESO` o `WHATSAPP_ID_NUMERO` configuradas,
 * `disponible()` devuelve false y el contenedor de dependencias no inyecta
 * este adaptador: el caso de uso trata el canal como si no existiera
 * adaptador, tal como hoy (§10.2).
 */
export class MetaWhatsAppNotificador implements NotificadorWhatsApp {
  constructor(
    private readonly token = process.env.WHATSAPP_TOKEN_ACCESO,
    private readonly idNumero = process.env.WHATSAPP_ID_NUMERO,
    private readonly plantilla = process.env.WHATSAPP_PLANTILLA_AVISO || "aviso_generico",
    private readonly idioma = process.env.WHATSAPP_PLANTILLA_IDIOMA || "es",
    private readonly version = process.env.WHATSAPP_VERSION_API || "v21.0",
  ) {}

  disponible(): boolean {
    return !!this.token && !!this.idNumero;
  }

  async enviar(mensaje: { para: string; texto: string }): Promise<{ id: string }> {
    if (!this.disponible()) {
      throw new Error(
        "WhatsApp no está configurado: falta WHATSAPP_TOKEN_ACCESO o WHATSAPP_ID_NUMERO (§15.1).",
      );
    }

    // Meta espera el numero en E.164 sin el "+" inicial.
    const destino = mensaje.para.replace(/^\+/, "");

    const respuesta = await fetch(
      `https://graph.facebook.com/${this.version}/${this.idNumero}/messages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: destino,
          type: "template",
          template: {
            name: this.plantilla,
            language: { code: this.idioma },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: mensaje.texto }],
              },
            ],
          },
        }),
      },
    );

    if (!respuesta.ok) {
      // El cuerpo del error de Meta es informativo y no lleva secretos.
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(`WhatsApp (Meta) respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
    }

    const datos = (await respuesta.json()) as { messages?: Array<{ id?: string }> };
    return { id: datos.messages?.[0]?.id ?? "sin-id" };
  }
}
