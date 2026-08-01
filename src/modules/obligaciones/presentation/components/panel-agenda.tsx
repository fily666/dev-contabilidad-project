import { CalendarClock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { InsigniaEstadoOcurrencia } from "@/shared/ui/insignias";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
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
  /** Moneda de respaldo cuando no hay eventos (la de `ajustes`). */
  moneda?: string;
  /** Sin proyecto cuando ya se está dentro de uno. */
  ocultarProyecto?: boolean;
  vacio?: { titulo: string; descripcion: string };
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
 * subtotal**. Antes había un total único en la cabecera que sumaba todo —vencidas
 * incluidas— mientras la tarjeta «Comprometido a 30 días» de la misma pantalla
 * sumaba solo lo futuro: dos cifras de aspecto idéntico, a cuarenta píxeles una
 * de otra, que nunca coincidían si había algo vencido.
 *
 * Un subtotal por grupo no puede contradecir a la tarjeta que resume ese mismo
 * grupo, y además responde algo que el total único no respondía: cuánto de lo
 * comprometido es urgente.
 */
export function PanelAgenda({
  eventos,
  metodosPago,
  hoy,
  formatoFecha,
  titulo = "Obligaciones próximas y vencidas",
  moneda = "COP",
  ocultarProyecto,
  vacio,
}: Props) {
  const grupos = agruparAgenda(eventos, moneda);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          {titulo}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {grupos.length === 0 ? (
          <EstadoVacio
            icono={<CalendarClock className="size-6" aria-hidden />}
            titulo={vacio?.titulo ?? "Nada por vencer"}
            descripcion={
              vacio?.descripcion ?? "No hay obligaciones pendientes en la ventana consultada."
            }
          />
        ) : (
          <div className="space-y-5">
            {grupos.map((grupo) => (
              <section key={grupo.clave}>
                <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
                  <h4 className={cn("etiqueta-dato", TONO_GRUPO[grupo.clave])}>
                    {grupo.titulo} ({grupo.eventos.length})
                  </h4>
                  <span className="text-sm font-medium tabular-nums">
                    {formatearDinero(grupo.total, grupo.moneda)}
                  </span>
                </div>

                <ul className="divide-y divide-border">
                  {grupo.eventos.map((evento) => (
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
      </CardContent>
    </Card>
  );
}
