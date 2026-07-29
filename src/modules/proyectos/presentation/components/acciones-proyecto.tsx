"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, CheckCircle2, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { EstadoProyecto } from "@/shared/domain/enumeraciones";
import { cambiarEstadoProyectoAction, eliminarProyectoAction } from "../actions";

type Props = { id: string; estado: EstadoProyecto };

/** RF-13, RF-18. */
export function AccionesProyecto({ id, estado }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  function cambiarEstado(nuevo: EstadoProyecto, mensaje: string) {
    iniciarTransicion(async () => {
      const resultado = await cambiarEstadoProyectoAction({ id, estado: nuevo });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(mensaje);
      router.refresh();
    });
  }

  function eliminar() {
    iniciarTransicion(async () => {
      const resultado = await eliminarProyectoAction({ id });
      setConfirmandoBorrado(false);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Proyecto eliminado.");
      router.push("/proyectos");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <EnlaceBoton href={`/proyectos/${id}/editar`} variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden /> Editar
        </EnlaceBoton>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                disabled={pendiente}
                aria-label="Más acciones"
              />
            }
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {estado !== "activo" ? (
              <DropdownMenuItem onClick={() => cambiarEstado("activo", "Proyecto reactivado.")}>
                <Play className="size-4" aria-hidden /> Reactivar
              </DropdownMenuItem>
            ) : null}
            {estado === "activo" ? (
              <DropdownMenuItem onClick={() => cambiarEstado("pausado", "Proyecto pausado.")}>
                <Pause className="size-4" aria-hidden /> Pausar
              </DropdownMenuItem>
            ) : null}
            {estado !== "finalizado" ? (
              <DropdownMenuItem onClick={() => cambiarEstado("finalizado", "Proyecto finalizado.")}>
                <CheckCircle2 className="size-4" aria-hidden /> Finalizar
              </DropdownMenuItem>
            ) : null}
            {estado !== "archivado" ? (
              <DropdownMenuItem onClick={() => cambiarEstado("archivado", "Proyecto archivado.")}>
                <Archive className="size-4" aria-hidden /> Archivar
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmandoBorrado(true)}>
              <Trash2 className="size-4" aria-hidden /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmandoBorrado} onOpenChange={setConfirmandoBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se puede eliminar un proyecto sin movimientos registrados. Si ya tiene
              movimientos, archívalo para conservar el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} disabled={pendiente}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
