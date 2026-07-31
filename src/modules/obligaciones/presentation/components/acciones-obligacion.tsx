"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { CategoriaConRuta } from "@/modules/categorias/domain/categoria.repository";
import type { ObligacionListada } from "../../domain/obligacion.repository";
import { cambiarEstadoObligacionAction, eliminarObligacionAction } from "../actions";
import { FormularioObligacion } from "./formulario-obligacion";

type Props = {
  obligacion: ObligacionListada;
  categorias: CategoriaConRuta[];
  hoy: string;
  horizonteMeses: number;
  formatoFecha?: string;
};

/** RF-50, RF-57. */
export function AccionesObligacion({
  obligacion,
  categorias,
  hoy,
  horizonteMeses,
  formatoFecha,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [edicionAbierta, setEdicionAbierta] = useState(false);
  const [borradoAbierto, setBorradoAbierto] = useState(false);

  function cambiarEstado(activa: boolean) {
    iniciarTransicion(async () => {
      const resultado = await cambiarEstadoObligacionAction({ id: obligacion.id, activa });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(activa ? "Obligación reactivada." : "Obligación suspendida.");
      router.refresh();
    });
  }

  function eliminar() {
    iniciarTransicion(async () => {
      const resultado = await eliminarObligacionAction({ id: obligacion.id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setBorradoAbierto(false);
      toast.success("Obligación eliminada.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Acciones de la obligación" />}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEdicionAbierta(true)}>
            <Pencil className="size-4" aria-hidden /> Editar
          </DropdownMenuItem>
          {obligacion.activa ? (
            <DropdownMenuItem onClick={() => cambiarEstado(false)} disabled={pendiente}>
              <Pause className="size-4" aria-hidden /> Suspender
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => cambiarEstado(true)} disabled={pendiente}>
              <Play className="size-4" aria-hidden /> Reactivar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setBorradoAbierto(true)}>
            <Trash2 className="size-4" aria-hidden /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={edicionAbierta} onOpenChange={setEdicionAbierta}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar obligación</DialogTitle>
            <DialogDescription>
              Los cambios se aplican a las ocurrencias que aún no se han pagado.
            </DialogDescription>
          </DialogHeader>

          <FormularioObligacion
            proyectos={[
              {
                id: obligacion.proyectoId,
                nombre: obligacion.proyectoNombre,
                tipoProyectoId: obligacion.tipoProyectoId,
              },
            ]}
            categorias={categorias}
            hoy={hoy}
            horizonteMeses={horizonteMeses}
            formatoFecha={formatoFecha}
            proyectoFijo={obligacion.proyectoId}
            obligacion={{
              id: obligacion.id,
              proyectoId: obligacion.proyectoId,
              categoriaId: obligacion.categoriaId,
              concepto: obligacion.concepto,
              valorEstimado: obligacion.valorEstimado,
              fechaVencimiento: obligacion.fechaVencimiento,
              frecuencia: obligacion.frecuencia,
              intervaloMeses: obligacion.intervaloMeses,
              diasAviso: obligacion.diasAviso,
            }}
            alTerminar={() => setEdicionAbierta(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={borradoAbierto} onOpenChange={setBorradoAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la obligación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminan también sus ocurrencias pendientes. Si alguna ya se pagó, la obligación es
              parte del historial y solo podrá suspenderse.
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
