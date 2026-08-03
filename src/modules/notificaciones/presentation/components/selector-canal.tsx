"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/shared/utils/cn";
import { ETIQUETA_CANAL_NOTIFICACION } from "@/shared/utils/etiquetas";
import { CANALES_NOTIFICACION, type CanalNotificacion } from "../../domain/notificacion.entity";

/** Filtro del historial de avisos. Viaja en la URL como el resto de la lectura (§7.6). */
export function SelectorCanal({ canal }: { canal: CanalNotificacion | "todos" }) {
  const router = useRouter();
  const parametros = useSearchParams();

  function aplicar(elegido: CanalNotificacion | "todos") {
    const nuevos = new URLSearchParams(parametros.toString());
    if (elegido === "todos") nuevos.delete("canal");
    else nuevos.set("canal", elegido);
    const consulta = nuevos.toString();
    router.push(consulta ? `?${consulta}` : "?");
  }

  const opciones: Array<{ valor: CanalNotificacion | "todos"; etiqueta: string }> = [
    { valor: "todos", etiqueta: "Todos" },
    ...CANALES_NOTIFICACION.map((valor) => ({
      valor,
      etiqueta: ETIQUETA_CANAL_NOTIFICACION[valor],
    })),
  ];

  return (
    <div
      role="group"
      aria-label="Canal del aviso"
      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-panel-alto/60 p-1"
    >
      {opciones.map(({ valor, etiqueta }) => {
        const activo = valor === canal;
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={activo}
            onClick={() => aplicar(valor)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activo
                ? "bg-gradient-to-r from-neon/25 to-neon-2/25 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}
