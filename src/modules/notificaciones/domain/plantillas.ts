import type { FechaIso } from "@/shared/domain/reloj";

/**
 * Plantillas de correo (Contexto.md §10.3).
 *
 * Viven en el dominio y devuelven texto plano y HTML: el proveedor (Resend) solo
 * transporta. Cambiar de proveedor no debe reescribir los mensajes, y probar el
 * contenido no debe requerir una clave de API.
 */

export type DatosAviso = {
  proyecto: string;
  concepto: string;
  valorEstimado: number;
  moneda: string;
  fechaVencimiento: FechaIso;
  diasRestantes: number;
  /** Enlace directo al registro del pago (§10.3). */
  enlace: string;
};

function dinero(valor: number, moneda: string): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(valor);
}

function envoltura(titulo: string, cuerpo: string): string {
  return [
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;color:#111827;line-height:1.5">`,
    `<h1 style="font-size:18px;margin:0 0 12px">${titulo}</h1>`,
    cuerpo,
    `<p style="margin-top:20px;font-size:12px;color:#6b7280">Gestor Financiero de Proyectos Personales</p>`,
    `</div>`,
  ].join("");
}

function textoDeDias(dias: number): string {
  if (dias < 0) return `venció hace ${Math.abs(dias)} día(s)`;
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `vence en ${dias} días`;
}

/** §10.3: aviso individual N días antes. */
export function plantillaAviso(datos: DatosAviso): { asunto: string; html: string; texto: string } {
  const importe = dinero(datos.valorEstimado, datos.moneda);
  const cuando = textoDeDias(datos.diasRestantes);
  const asunto =
    datos.diasRestantes < 0
      ? `Vencido: ${datos.concepto} · ${datos.proyecto}`
      : `${datos.concepto} ${cuando} · ${datos.proyecto}`;

  const texto = [
    `${datos.concepto} del proyecto ${datos.proyecto} ${cuando}.`,
    `Fecha de vencimiento: ${datos.fechaVencimiento}.`,
    `Valor estimado: ${importe}.`,
    `Registrar el pago: ${datos.enlace}`,
  ].join("\n");

  const html = envoltura(
    asunto,
    [
      `<p><strong>${datos.concepto}</strong> del proyecto <strong>${datos.proyecto}</strong> ${cuando}.</p>`,
      `<table style="border-collapse:collapse;margin:12px 0">`,
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Vencimiento</td><td style="padding:4px 0"><strong>${datos.fechaVencimiento}</strong></td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Valor estimado</td><td style="padding:4px 0"><strong>${importe}</strong></td></tr>`,
      `</table>`,
      `<p><a href="${datos.enlace}" style="color:#2563eb">Registrar el pago</a></p>`,
    ].join(""),
  );

  return { asunto, html, texto };
}

/** §10.3: resumen de los próximos vencimientos (lunes). */
export function plantillaResumen(entrada: { eventos: DatosAviso[]; enlace: string }): {
  asunto: string;
  html: string;
  texto: string;
} {
  const total = entrada.eventos.reduce((suma, e) => suma + e.valorEstimado, 0);
  const moneda = entrada.eventos[0]?.moneda ?? "COP";
  const asunto = `Resumen semanal: ${entrada.eventos.length} vencimiento(s) por ${dinero(total, moneda)}`;

  const lineas = entrada.eventos.map(
    (e) =>
      `- ${e.fechaVencimiento} · ${e.proyecto} · ${e.concepto} · ${dinero(e.valorEstimado, e.moneda)} (${textoDeDias(e.diasRestantes)})`,
  );

  const filas = entrada.eventos
    .map(
      (e) =>
        `<tr><td style="padding:4px 12px 4px 0">${e.fechaVencimiento}</td><td style="padding:4px 12px 4px 0">${e.proyecto}</td><td style="padding:4px 12px 4px 0">${e.concepto}</td><td style="padding:4px 0;text-align:right"><strong>${dinero(e.valorEstimado, e.moneda)}</strong></td></tr>`,
    )
    .join("");

  return {
    asunto,
    texto: [asunto, "", ...lineas, "", `Ver el calendario: ${entrada.enlace}`].join("\n"),
    html: envoltura(
      asunto,
      [
        `<table style="border-collapse:collapse;font-size:13px">${filas}</table>`,
        `<p style="margin-top:12px"><a href="${entrada.enlace}" style="color:#2563eb">Ver el calendario</a></p>`,
      ].join(""),
    ),
  };
}
