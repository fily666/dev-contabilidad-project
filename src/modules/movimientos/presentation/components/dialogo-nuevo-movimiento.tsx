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
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import { FormularioMovimiento, type OpcionProyecto } from "./formulario-movimiento";

type Props = {
  proyectos: OpcionProyecto[];
  categorias: CategoriaConRuta[];
  metodosPago: MetodoPagoVista[];
  hoy: string;
  proyectoFijo?: string;
  etiqueta?: string;
};

export function DialogoNuevoMovimiento({
  proyectos,
  categorias,
  metodosPago,
  hoy,
  proyectoFijo,
  etiqueta = "Nuevo movimiento",
}: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button disabled={proyectos.length === 0} />}>
        <Plus className="size-4" aria-hidden /> {etiqueta}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar movimiento</DialogTitle>
          <DialogDescription>
            La naturaleza decide si el egreso capitaliza (inversión) o es gasto operativo.
          </DialogDescription>
        </DialogHeader>

        <FormularioMovimiento
          proyectos={proyectos}
          categorias={categorias}
          metodosPago={metodosPago}
          hoy={hoy}
          proyectoFijo={proyectoFijo}
          alTerminar={() => setAbierto(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
