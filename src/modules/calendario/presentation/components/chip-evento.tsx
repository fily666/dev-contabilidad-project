"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { InsigniaEstadoMovimiento, InsigniaEstadoOcurrencia } from "@/shared/ui/insignias";
import type { EstadoMovimiento, EstadoOcurrencia } from "@/shared/domain/enumeraciones";
import { cn } from "@/shared/utils/cn";
import { formatearDinero, formatearFechaLarga } from "@/shared/utils/formato";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import { DialogoPagoOcurrencia } from "@/modules/obligaciones/presentation/components/dialogo-pago-ocurrencia";
import type { EventoCalendario } from "../../domain/mes";
import { CLASES_ESTADO_EVENTO } from "../estilos-evento";

type Props = {
  evento: EventoCalendario;
  metodosPago: MetodoPagoVista[];
  hoy: string;
};

/** RF-64: al abrir el evento se ofrece el pago o el detalle. */
export function ChipEvento({ evento, metodosPago, hoy }: Props) {
  const [abierto, setAbierto] = useState(false);
  const pendiente = evento.estado === "pendiente" || String(evento.estado).startsWith("venc");

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title={`${evento.concepto} · ${formatearDinero(evento.valor, evento.moneda)}`}
        className={cn(
          "flex w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-4 transition-colors hover:brightness-110",
          CLASES_ESTADO_EVENTO[evento.estado] ?? "border-border bg-muted",
        )}
      >
        {evento.tipo === "ingreso" ? (
          <ArrowUpRight className="size-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDownRight className="size-3 shrink-0" aria-hidden />
        )}
        <span className="truncate">{evento.concepto}</span>
      </button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="truncate">{evento.concepto}</DialogTitle>
            <DialogDescription>
              {evento.proyectoNombre} · {formatearFechaLarga(evento.fecha)}
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="etiqueta-dato">Valor</dt>
              <dd className="mt-1 font-medium tabular-nums">
                {formatearDinero(evento.valor, evento.moneda)}
              </dd>
            </div>
            <div>
              <dt className="etiqueta-dato">Estado</dt>
              {/*
                La insignia del resto del producto, no el valor crudo del enum
                capitalizado. Este diálogo escribía «Vencida» en texto negro
                mientras la misma ocurrencia se pintaba en rojo en la rejilla de
                detrás y como insignia roja en Obligaciones: tres presentaciones
                del mismo estado, una de ellas sin color.
              */}
              <dd className="mt-1">
                {evento.clase === "ocurrencia" ? (
                  <InsigniaEstadoOcurrencia estado={evento.estado as EstadoOcurrencia} />
                ) : (
                  <InsigniaEstadoMovimiento estado={evento.estado as EstadoMovimiento} />
                )}
              </dd>
            </div>
            <div>
              <dt className="etiqueta-dato">Origen</dt>
              <dd className="mt-1 font-medium">
                {evento.clase === "ocurrencia" ? "Obligación recurrente" : "Movimiento"}
              </dd>
            </div>
          </dl>

          <DialogFooter className="flex-wrap gap-2">
            {evento.clase === "ocurrencia" && evento.ocurrenciaId && pendiente ? (
              <DialogoPagoOcurrencia
                ocurrenciaId={evento.ocurrenciaId}
                concepto={evento.concepto}
                valorEstimado={evento.valor}
                metodosPago={metodosPago}
                hoy={hoy}
              />
            ) : null}

            <EnlaceBoton
              href={
                evento.clase === "ocurrencia"
                  ? `/proyectos/${evento.proyectoId}/obligaciones`
                  : `/proyectos/${evento.proyectoId}/movimientos`
              }
              variant="secondary"
            >
              Ver detalle
            </EnlaceBoton>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
