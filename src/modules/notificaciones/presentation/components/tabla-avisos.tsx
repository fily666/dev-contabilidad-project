"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck } from "lucide-react";

import type { Resultado } from "@/shared/domain/resultado";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { InsigniaEstadoNotificacion } from "@/shared/ui/insignias";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/utils/cn";
import { ETIQUETA_CANAL_NOTIFICACION } from "@/shared/utils/etiquetas";
import type { CanalNotificacion } from "../../domain/notificacion.entity";
import { marcarAvisoLeidoAction, marcarTodosLosAvisosLeidosAction } from "../actions";

/** Igual que en la campana: el instante llega ya formateado por el servidor (§8.5). */
export type AvisoEnTabla = {
  id: string;
  canal: CanalNotificacion;
  asunto: string;
  cuerpo: string;
  estado: React.ComponentProps<typeof InsigniaEstadoNotificacion>["estado"];
  intentos: number;
  error: string | null;
  programadaPara: string;
  enviadaEn: string | null;
  /** Null cuando el canal no es in-app: esos no se leen aquí (§10.2). */
  leido: boolean | null;
};

type Props = {
  avisos: AvisoEnTabla[];
  noLeidos: number;
};

/**
 * Historial de avisos (RF-59, §10.2).
 *
 * Muestra los tres canales y los cuatro estados de envío, que es lo que
 * responde la pregunta que la campana no puede: si un aviso salió, si se está
 * reintentando o si se canceló. La columna de lectura solo aplica al canal
 * in-app —un correo se lee en el cliente de correo—, y ahí va un guion en lugar
 * de un falso «no leído».
 */
export function TablaAvisos({ avisos, noLeidos }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  function marcar(accion: () => Promise<Resultado<unknown>>, exito: string) {
    iniciarTransicion(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(exito);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {noLeidos > 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-panel-alto/40 px-4 py-2.5">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{noLeidos}</span> aviso(s) sin leer en la
            campana.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={pendiente}
            onClick={() =>
              marcar(() => marcarTodosLosAvisosLeidosAction(), "Avisos marcados como leídos.")
            }
          >
            <CheckCheck className="size-3.5" aria-hidden />
            Marcar todo como leído
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aviso</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Programado</TableHead>
              <TableHead>Envío</TableHead>
              <TableHead className="text-right">Lectura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {avisos.map((aviso) => (
              <TableRow key={aviso.id} className={cn(aviso.leido === false && "bg-neon/[0.04]")}>
                <TableCell className="max-w-md">
                  <p className={cn("truncate", aviso.leido === false && "font-medium")}>
                    {aviso.asunto}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{aviso.cuerpo}</p>
                  {aviso.error ? (
                    <p className="mt-1 line-clamp-2 text-xs text-destructive">{aviso.error}</p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {ETIQUETA_CANAL_NOTIFICACION[aviso.canal]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                  {aviso.programadaPara}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <InsigniaEstadoNotificacion estado={aviso.estado} intentos={aviso.intentos} />
                  {aviso.enviadaEn ? (
                    <span className="etiqueta-dato mt-1 block">{aviso.enviadaEn}</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {aviso.leido === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : aviso.leido ? (
                    <span className="etiqueta-dato">Leído</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      disabled={pendiente}
                      onClick={() =>
                        marcar(
                          () => marcarAvisoLeidoAction({ id: aviso.id }),
                          "Aviso marcado como leído.",
                        )
                      }
                    >
                      <Check className="size-3.5" aria-hidden />
                      Marcar leído
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
