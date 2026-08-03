/**
 * RF-61: el color de un evento del calendario, en un solo sitio.
 *
 * Vivía dentro de `chip-evento.tsx`, así que la leyenda de la vista no podía
 * consultarlo: describía los colores **por escrito** —«azul pendiente, rojo
 * vencido»— y cualquier cambio de tono dejaba la frase mintiendo sin que nada
 * fallara. Aquí lo comparten el chip y la leyenda, y las muestras de la leyenda
 * son literalmente el mismo estilo que la rejilla pinta.
 *
 * El pagado se apaga a propósito: lo que necesita atención es lo que sigue
 * pendiente.
 */
export const CLASES_ESTADO_EVENTO: Record<string, string> = {
  pagado: "border-success/30 bg-success-soft text-success-foreground",
  pagada: "border-success/30 bg-success-soft text-success-foreground",
  pendiente: "border-info/30 bg-info-soft text-foreground",
  vencido: "border-destructive/40 bg-danger-soft text-destructive",
  vencida: "border-destructive/40 bg-danger-soft text-destructive",
  omitida: "border-border bg-muted text-muted-foreground line-through",
};

/** Los cuatro estados que la leyenda nombra, con la etiqueta que ve el usuario. */
export const LEYENDA_ESTADOS: Array<{ estado: string; etiqueta: string }> = [
  { estado: "pendiente", etiqueta: "Pendiente" },
  { estado: "vencido", etiqueta: "Vencido" },
  { estado: "pagado", etiqueta: "Pagado" },
  { estado: "omitida", etiqueta: "Omitido" },
];
