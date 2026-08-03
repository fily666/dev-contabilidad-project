"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Check, CheckCheck } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/shared/ui/popover";
import { cn } from "@/shared/utils/cn";
import { marcarAvisoLeidoAction, marcarTodosLosAvisosLeidosAction } from "../actions";

/**
 * Vista de un aviso ya formateada por el servidor. El instante llega como texto
 * hecho —no como ISO— porque formatearlo aquí exigiría el reloj del navegador y
 * la zona de la instalación, y las dos cosas discreparían del servidor en la
 * primera pintura (§8.5).
 */
export type AvisoEnCampana = {
  id: string;
  asunto: string;
  cuerpo: string;
  cuando: string;
  leido: boolean;
};

type Props = {
  avisos: AvisoEnCampana[];
  noLeidos: number;
};

/**
 * Campana de avisos in-app (Contexto.md §10.2, RF-59).
 *
 * Era el último hueco abierto de §17: la tarea diaria escribía las filas con
 * `canal = 'in_app'` y ninguna pantalla las leía. Los datos los trae el layout
 * privado en el render del servidor, así que no hay sondeo ni estado de cliente
 * que sincronizar (§7.6); tras marcar algo leído basta con `router.refresh()`,
 * que vuelve a pedir el layout con el contador ya actualizado.
 */
export function CampanaAvisos({ avisos, noLeidos }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  function marcarUno(id: string) {
    iniciarTransicion(async () => {
      const resultado = await marcarAvisoLeidoAction({ id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      router.refresh();
    });
  }

  function marcarTodos() {
    iniciarTransicion(async () => {
      const resultado = await marcarTodosLosAvisosLeidosAction();
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(
        resultado.data.leidos === 1
          ? "1 aviso marcado como leído."
          : `${resultado.data.leidos} avisos marcados como leídos.`,
      );
      router.refresh();
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={noLeidos > 0 ? `Avisos: ${noLeidos} sin leer` : "Avisos: ninguno sin leer"}
          />
        }
      >
        <Bell className="size-5" aria-hidden />
        {noLeidos > 0 ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-neon px-1 text-[10px] leading-4 font-semibold text-background shadow-[0_0_10px_var(--neon-brillo)]"
          >
            {noLeidos > 9 ? "9+" : noLeidos}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent className="w-[min(22rem,calc(100vw-1.5rem))]">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
          <PopoverTitle>Avisos</PopoverTitle>
          {noLeidos > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={marcarTodos}
              disabled={pendiente}
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Marcar todo
            </Button>
          ) : (
            <span className="etiqueta-dato">Al día</span>
          )}
        </div>

        {avisos.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No hay avisos. Los vencimientos próximos aparecen aquí según los días de anticipación
            configurados.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto">
            {avisos.map((aviso) => (
              <li
                key={aviso.id}
                className={cn(
                  "flex items-start gap-2 px-3 py-2.5",
                  !aviso.leido && "bg-neon/[0.04]",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    aviso.leido ? "bg-transparent" : "bg-neon shadow-[0_0_8px_var(--neon-brillo)]",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", aviso.leido ? "" : "font-medium")}>
                    {aviso.asunto}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{aviso.cuerpo}</p>
                  <p className="etiqueta-dato mt-1">{aviso.cuando}</p>
                </div>
                {!aviso.leido ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={`Marcar «${aviso.asunto}» como leído`}
                    onClick={() => marcarUno(aviso.id)}
                    disabled={pendiente}
                  >
                    <Check className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/70 px-3 py-2">
          <Link
            href="/avisos"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver todos los avisos
          </Link>
          <Link
            href="/obligaciones"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ir a obligaciones
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
