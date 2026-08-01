"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/shared/utils/cn";
import { VENTANAS_AGENDA, type VentanaAgenda } from "../../domain/agenda";

/**
 * RF-58 completo: 7, 30 y 90 días.
 *
 * Antes cada vista tenía su ventana fija y distinta —30 días en `/obligaciones`,
 * 30 en el detalle del proyecto y 90 en las obligaciones del proyecto—, sin que
 * nada explicara la diferencia. La misma pregunta, «¿qué me vence?», daba tres
 * respuestas según por dónde se entrara.
 *
 * La ventana viaja en la URL como el resto del estado de lectura (§7.6), así que
 * el dashboard puede enlazar a una ventana concreta ya aplicada.
 */
export function SelectorVentana({ ventana }: { ventana: VentanaAgenda }) {
  const router = useRouter();
  const parametros = useSearchParams();

  function aplicar(dias: VentanaAgenda) {
    const nuevos = new URLSearchParams(parametros.toString());
    if (dias === 30) nuevos.delete("dias");
    else nuevos.set("dias", String(dias));
    const consulta = nuevos.toString();
    router.push(consulta ? `?${consulta}` : "?");
  }

  return (
    <div
      role="group"
      aria-label="Ventana de vencimientos"
      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-panel-alto/60 p-1"
    >
      {VENTANAS_AGENDA.map((dias) => {
        const activo = dias === ventana;
        return (
          <button
            key={dias}
            type="button"
            aria-pressed={activo}
            onClick={() => aplicar(dias)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activo
                ? "bg-gradient-to-r from-neon/25 to-neon-2/25 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {dias} días
          </button>
        );
      })}
    </div>
  );
}
