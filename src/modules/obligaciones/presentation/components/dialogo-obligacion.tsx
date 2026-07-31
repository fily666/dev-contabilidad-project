"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import type { CategoriaConRuta } from "@/modules/categorias/domain/categoria.repository";
import { FormularioObligacion, type OpcionProyectoObligacion } from "./formulario-obligacion";

type Props = {
  proyectos: OpcionProyectoObligacion[];
  categorias: CategoriaConRuta[];
  hoy: string;
  horizonteMeses: number;
  formatoFecha?: string;
  proyectoFijo?: string;
  etiqueta?: string;
};

/** RF-50: crear obligación desde la lista o desde el proyecto. */
export function DialogoObligacion({
  proyectos,
  categorias,
  hoy,
  horizonteMeses,
  formatoFecha,
  proyectoFijo,
  etiqueta = "Nueva obligación",
}: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button disabled={proyectos.length === 0} />}>
        <Plus className="size-4" aria-hidden /> {etiqueta}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva obligación</DialogTitle>
          <DialogDescription>
            Un compromiso recurrente. Cada vencimiento se materializa como ocurrencia y pagarla es
            lo que crea el movimiento.
          </DialogDescription>
        </DialogHeader>

        <FormularioObligacion
          proyectos={proyectos}
          categorias={categorias}
          hoy={hoy}
          horizonteMeses={horizonteMeses}
          formatoFecha={formatoFecha}
          proyectoFijo={proyectoFijo}
          alTerminar={() => setAbierto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
