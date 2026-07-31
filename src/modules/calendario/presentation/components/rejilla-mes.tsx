import { cn } from "@/shared/utils/cn";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import { NOMBRES_DIAS, type DiaCalendario } from "../../domain/mes";
import { ChipEvento } from "./chip-evento";

type Props = {
  dias: DiaCalendario[];
  metodosPago: MetodoPagoVista[];
  hoy: string;
  moneda: string;
};

/**
 * RF-60: rejilla mensual. En móvil se abandona la rejilla y se listan solo los
 * días con eventos: siete columnas a 375 px no se leen (RNF-01).
 */
export function RejillaMes({ dias, metodosPago, hoy, moneda }: Props) {
  const conEventos = dias.filter((dia) => dia.delMes && dia.eventos.length > 0);

  return (
    <>
      <div className="panel hidden overflow-hidden p-2 md:block">
        <div className="grid grid-cols-7 gap-1">
          {NOMBRES_DIAS.map((nombre) => (
            <div key={nombre} className="etiqueta-dato px-2 py-1 text-center">
              {nombre}
            </div>
          ))}

          {dias.map((dia) => (
            <div
              key={dia.fecha}
              className={cn(
                "min-h-24 rounded-lg border border-border/60 p-1.5",
                dia.delMes ? "bg-panel-alto/40" : "bg-transparent opacity-45",
                dia.esHoy && "border-neon/60 ring-1 ring-neon/30",
              )}
            >
              <div className="mb-1 flex items-baseline justify-between gap-1">
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    dia.esHoy ? "font-semibold text-neon" : "text-muted-foreground",
                  )}
                >
                  {Number(dia.fecha.slice(8, 10))}
                </span>
                {dia.comprometido > 0 ? (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatearDineroCompacto(dia.comprometido, moneda)}
                  </span>
                ) : null}
              </div>

              <div className="space-y-1">
                {dia.eventos.slice(0, 3).map((evento) => (
                  <ChipEvento key={evento.id} evento={evento} metodosPago={metodosPago} hoy={hoy} />
                ))}
                {dia.eventos.length > 3 ? (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{dia.eventos.length - 3} más
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ul className="space-y-3 md:hidden">
        {conEventos.map((dia) => (
          <li key={dia.fecha} className="panel p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="font-medium">
                {Number(dia.fecha.slice(8, 10))} {dia.esHoy ? "· hoy" : ""}
              </p>
              {dia.comprometido > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatearDineroCompacto(dia.comprometido, moneda)} comprometido
                </span>
              ) : null}
            </div>
            <div className="space-y-1">
              {dia.eventos.map((evento) => (
                <ChipEvento key={evento.id} evento={evento} metodosPago={metodosPago} hoy={hoy} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
