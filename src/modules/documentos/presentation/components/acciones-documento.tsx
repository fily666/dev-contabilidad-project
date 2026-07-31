"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, MoreHorizontal, Trash2 } from "lucide-react";

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
import { eliminarDocumentoAction, urlDocumentoAction } from "../actions";

type Props = {
  id: string;
  nombreArchivo: string;
  esPrevisualizable: boolean;
  esImagen: boolean;
};

/** RF-44, RF-45, RF-46. */
export function AccionesDocumento({ id, nombreArchivo, esPrevisualizable, esImagen }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [urlPrevia, setUrlPrevia] = useState<string | null>(null);
  const [borradoAbierto, setBorradoAbierto] = useState(false);

  /** La URL se pide al abrir, no al pintar la lista: dura 60 minutos (RF-45). */
  function abrir(modo: "previsualizar" | "descargar") {
    iniciarTransicion(async () => {
      const resultado = await urlDocumentoAction({ id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      if (modo === "previsualizar") setUrlPrevia(resultado.data.url);
      else window.open(resultado.data.url, "_blank", "noopener,noreferrer");
    });
  }

  function eliminar() {
    iniciarTransicion(async () => {
      const resultado = await eliminarDocumentoAction({ id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setBorradoAbierto(false);
      toast.success("Soporte eliminado.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label={`Acciones de ${nombreArchivo}`} />
          }
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {esPrevisualizable ? (
            <DropdownMenuItem onClick={() => abrir("previsualizar")} disabled={pendiente}>
              <Eye className="size-4" aria-hidden /> Previsualizar
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => abrir("descargar")} disabled={pendiente}>
            <Download className="size-4" aria-hidden /> Descargar
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setBorradoAbierto(true)}>
            <Trash2 className="size-4" aria-hidden /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={urlPrevia !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setUrlPrevia(null);
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{nombreArchivo}</DialogTitle>
            <DialogDescription>
              Enlace firmado con vigencia de 60 minutos; después deja de funcionar.
            </DialogDescription>
          </DialogHeader>

          {urlPrevia ? (
            esImagen ? (
              // La URL es firmada y de vida corta: optimizarla con next/image
              // exigiria declarar el host de Supabase como remoto permitido, y
              // para una previsualizacion puntual no compensa.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlPrevia}
                alt={nombreArchivo}
                className="max-h-[70svh] w-full rounded-md object-contain"
              />
            ) : (
              <iframe
                src={urlPrevia}
                title={nombreArchivo}
                className="h-[70svh] w-full rounded-md border"
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={borradoAbierto} onOpenChange={setBorradoAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el soporte?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina el archivo del almacenamiento y el registro queda marcado como eliminado.
              No se puede deshacer.
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
