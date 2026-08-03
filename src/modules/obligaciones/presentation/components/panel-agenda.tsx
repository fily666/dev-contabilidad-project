import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { InsigniaEstadoOcurrencia } from "@/shared/ui/insignias";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { PanelDatos } from "@/shared/ui/panel-datos";
import { cn } from "@/shared/utils/cn";
import { formatearDinero, formatearFecha } from "@/shared/utils/formato";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import { agruparAgenda, type ClaveGrupoAgenda } from "../../domain/agenda";
import type { EventoAgenda } from "../../domain/obligacion.repository";
import { DialogoPagoOcurrencia } from "./dialogo-pago-ocurrencia";

type Props = {
  eventos: EventoAgenda[];
  metodosPago: MetodoPagoVista[];
  hoy: string;
  /** Patron de fecha elegido en los ajustes (RF-101). */
  formatoFecha?: string;
  titulo?: string;
  /** Control de la cabecera: el selector de ventana de RF-58, cuando aplica. */
  accion?: React.ReactNode;
  /** Moneda de respaldo cuando no hay eventos (la de `ajustes`). */
  moneda?: string;
  /** Sin proyecto cuando ya se está dentro de uno. */
  ocultarProyecto?: boolean;
  vacio?: { titulo: string; descripcion: string };
  /**
   * Tope de vencimientos listados. Sin él la lista crece sin límite, y en una
   * rejilla de dos columnas eso estira al panel vecino: el del flujo de caja
   * llegaba a ~700 px de alto con un trazo de 240 px y el resto en blanco.
   *
   * El recorte se aplica a los eventos YA ordenados por urgencia, así que lo que
   * se esconde es siempre lo menos urgente, y el pie dice cuánto es y dónde está.
   */
  maximo?: number;
  /** Destino del pie cuando el tope recorta: la vista que sí lo lista todo. */
  verTodo?: { href: string; etiqueta?: string };
};

function textoDias(dias: number): string {
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} día(s)`;
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `En ${dias} días`;
}

/** Cada grupo lleva su tono: la urgencia se lee antes que la etiqueta (RF-61). */
const TONO_GRUPO: Record<ClaveGrupoAgenda, string> = {
  vencidas: "text-destructive",
  semana: "text-warning",
  resto: "text-muted-foreground",
};

/**
 * RF-58, RF-73: vencidas y próximas a vencer, con pago en un clic.
 *
 * Los eventos van agrupados por urgencia y **cada grupo lleva su propio
 * subtotal**, no un total único en la cabecera. Un subtotal por grupo no puede
 * contradecir a la tarjeta que resume ese mismo grupo —un total que incluya lo
 * vencido nunca coincide con un «Comprometido a 30 días» que no lo incluye— y
 * además responde cuánto de lo comprometido es urgente.
 */
export function PanelAgenda({
  eventos,
  metodosPago,
  hoy,
  formatoFecha,
  titulo = "Obligaciones próximas y vencidas",
  accion,
  moneda = "COP",
  ocultarProyecto,
  vacio,
  maximo,
  verTodo,
}: Props) {
  /*
    Los grupos se calculan SIEMPRE sobre todos los eventos y el recorte se aplica
    solo a las filas que se pintan.

    Agrupar la lista ya recortada habría sido lo cómodo y habría vuelto a partir en
    dos una cifra que el dominio define una sola vez (ADR-11): «Vencidas (2) ·
    $ 2,4 M» contando lo visible, junto a una cabecera que suma los diez de la
    ventana. Los subtotales describen la ventana; la lista es una vista previa y el
    pie dice cuánto falta y dónde está.

    El presupuesto de filas se reparte en orden de urgencia —vencidas, esta semana,
    más adelante—, así que lo que se esconde es siempre lo que menos corre.
  */
  const grupos = agruparAgenda(eventos, moneda);
  const total = eventos.reduce((suma, evento) => suma + evento.valorEstimado, 0);

  let presupuesto = maximo ?? Number.POSITIVE_INFINITY;
  const visibles = grupos.map((grupo) => {
    // La línea del grupo se pinta SIEMPRE, aunque no le toque ninguna fila: son
    // unos 30 px y sin ella los subtotales a la vista no suman el total de la
    // cabecera, que es una resta que el lector hace y no le cuadra. Con las tres
    // líneas presentes, «Más adelante (2) · $ 4,4 M» explica la diferencia en vez
    // de esconderla.
    const filas = presupuesto > 0 ? grupo.eventos.slice(0, presupuesto) : [];
    presupuesto -= filas.length;
    return { ...grupo, filas, cuantos: grupo.eventos.length };
  });

  const ocultos = eventos.length - visibles.reduce((suma, g) => suma + g.filas.length, 0);

  return (
    <PanelDatos
      titulo={titulo}
      // El conteo va en la cabecera y el importe de cada grupo en su subtotal: el
      // total de la cabecera sumaría lo vencido con lo futuro, que es justo la
      // cifra ambigua que los subtotales vinieron a sustituir.
      aparte={
        eventos.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {eventos.length} · {formatearDinero(total, moneda)}
          </span>
        ) : null
      }
      accion={accion}
    >
      {grupos.length === 0 ? (
        // `denso`: la variante de página reservaba unos 320 px para decir «nada
        // pendiente», y en el panel general —donde lo normal es no tener nada
        // vencido— ese hueco era el bloque más alto de la vista.
        <EstadoVacio
          denso
          titulo={vacio?.titulo ?? "Nada por vencer"}
          descripcion={
            vacio?.descripcion ?? "No hay obligaciones pendientes en la ventana consultada."
          }
        />
      ) : (
        <div className="space-y-5">
          {visibles.map((grupo) => (
            <section key={grupo.clave}>
              <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
                {/* Conteo y subtotal de TODO el grupo, aunque se listen menos. */}
                <h4 className={cn("etiqueta-dato", TONO_GRUPO[grupo.clave])}>
                  {grupo.titulo} ({grupo.cuantos})
                </h4>
                <span className="text-sm font-medium tabular-nums">
                  {formatearDinero(grupo.total, grupo.moneda)}
                </span>
              </div>

              <ul className="divide-y divide-border">
                {grupo.filas.map((evento) => (
                  <li
                    key={evento.ocurrenciaId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{evento.concepto}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ocultarProyecto ? "" : `${evento.proyectoNombre} · `}
                        {formatearFecha(evento.fechaVencimiento, formatoFecha)}
                        {" · "}
                        <span className={cn("font-medium", TONO_GRUPO[grupo.clave])}>
                          {textoDias(evento.diasRestantes)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">
                        {formatearDinero(evento.valorEstimado, evento.moneda)}
                      </span>
                      <InsigniaEstadoOcurrencia estado={evento.estado} />
                      <DialogoPagoOcurrencia
                        ocurrenciaId={evento.ocurrenciaId}
                        concepto={evento.concepto}
                        valorEstimado={evento.valorEstimado}
                        metodosPago={metodosPago}
                        hoy={hoy}
                        compacto
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {ocultos > 0 && verTodo ? (
        <Link
          href={verTodo.href}
          className="mt-auto flex items-center justify-center gap-1.5 border-t border-border/60 pt-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {ocultos === 1 ? "1 vencimiento más" : `${ocultos} vencimientos más`} en{" "}
          {verTodo.etiqueta ?? "la agenda completa"}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </PanelDatos>
  );
}
