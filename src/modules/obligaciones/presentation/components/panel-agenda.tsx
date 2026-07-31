import { AlertTriangle, CalendarClock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { InsigniaEstadoOcurrencia } from "@/shared/ui/insignias";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { cn } from "@/shared/utils/cn";
import { formatearDinero, formatearFecha } from "@/shared/utils/formato";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import type { EventoAgenda } from "../../domain/obligacion.repository";
import { DialogoPagoOcurrencia } from "./dialogo-pago-ocurrencia";

type Props = {
  eventos: EventoAgenda[];
  metodosPago: MetodoPagoVista[];
  hoy: string;
  formatoFecha?: string;
  titulo?: string;
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

/** RF-58, RF-73: vencidas y próximas a vencer, con pago en un clic. */
export function PanelAgenda({
  eventos,
  metodosPago,
  hoy,
  formatoFecha,
  titulo = "Obligaciones próximas y vencidas",
  ocultarProyecto,
  vacio,
}: Props) {
  const total = eventos.reduce((suma, e) => suma + e.valorEstimado, 0);
  const moneda = eventos[0]?.moneda ?? "COP";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
          {titulo}
        </CardTitle>
        {eventos.length > 0 ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatearDinero(total, moneda)} comprometidos
          </span>
        ) : null}
      </CardHeader>

      <CardContent>
        {eventos.length === 0 ? (
          <EstadoVacio
            icono={<CalendarClock className="size-6" aria-hidden />}
            titulo={vacio?.titulo ?? "Nada por vencer"}
            descripcion={
              vacio?.descripcion ?? "No hay obligaciones pendientes en la ventana consultada."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {eventos.map((evento) => (
              <li
                key={evento.ocurrenciaId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{evento.concepto}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ocultarProyecto ? "" : `${evento.proyectoNombre} · `}
                    {formatearFecha(evento.fechaVencimiento, formatoFecha)}
                    {" · "}
                    <span
                      className={cn(
                        evento.diasRestantes < 0 && "font-medium text-destructive",
                        evento.diasRestantes >= 0 && evento.diasRestantes <= 7 && "text-warning",
                      )}
                    >
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
        )}

        {eventos.some((e) => e.diasRestantes < 0) ? (
          <p className="mt-4 flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5" aria-hidden />
            Hay obligaciones vencidas: el estado financiero del proyecto pasa a «en riesgo» (§5.5).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
