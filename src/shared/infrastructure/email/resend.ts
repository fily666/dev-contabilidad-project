import "server-only";

import type { NotificadorEmail } from "@/modules/notificaciones/domain/notificacion.repository";

/**
 * ADAPTADOR del puerto NotificadorEmail sobre Resend (Contexto.md §7.3, §10.2).
 *
 * Se habla con la API REST directamente en lugar de instalar el SDK: es una sola
 * peticion POST, y una dependencia menos en un proyecto que ya declara la lista
 * de librerias en §8.1.
 *
 * Sin `RESEND_API_KEY` configurada, `disponible()` devuelve false y el caso de uso
 * no intenta enviar: el correo es de Fase 4 y la aplicacion tiene que funcionar
 * antes de que exista la clave (§15.1).
 */
export class ResendNotificador implements NotificadorEmail {
  constructor(
    private readonly clave = process.env.RESEND_API_KEY,
    private readonly remitente = process.env.EMAIL_REMITENTE,
  ) {}

  disponible(): boolean {
    return !!this.clave && !!this.remitente;
  }

  async enviar(mensaje: {
    para: string;
    asunto: string;
    html: string;
    texto: string;
  }): Promise<{ id: string }> {
    if (!this.disponible()) {
      throw new Error(
        "El correo no está configurado: falta RESEND_API_KEY o EMAIL_REMITENTE (§15.1).",
      );
    }

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.clave}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.remitente,
        to: [mensaje.para],
        subject: mensaje.asunto,
        html: mensaje.html,
        text: mensaje.texto,
      }),
    });

    if (!respuesta.ok) {
      // El cuerpo del error de Resend es informativo y no lleva secretos.
      const detalle = await respuesta.text().catch(() => "");
      throw new Error(`Resend respondió ${respuesta.status}: ${detalle.slice(0, 300)}`);
    }

    const datos = (await respuesta.json()) as { id?: string };
    return { id: datos.id ?? "sin-id" };
  }
}
