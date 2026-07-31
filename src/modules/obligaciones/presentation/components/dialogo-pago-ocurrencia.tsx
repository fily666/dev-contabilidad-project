"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, SkipForward } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import { cambiarEstadoOcurrenciaAction, pagarOcurrenciaAction } from "../actions";

type Props = {
  ocurrenciaId: string;
  concepto: string;
  valorEstimado: number;
  metodosPago: MetodoPagoVista[];
  hoy: string;
  /** Presentación compacta para el calendario y la agenda. */
  compacto?: boolean;
};

/** RF-54, RF-56: pagar crea el movimiento; omitir no afecta a las siguientes. */
export function DialogoPagoOcurrencia({
  ocurrenciaId,
  concepto,
  valorEstimado,
  metodosPago,
  hoy,
  compacto,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(valorEstimado > 0 ? String(valorEstimado) : "");
  const [fechaPago, setFechaPago] = useState(hoy);
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? "");
  const [observaciones, setObservaciones] = useState("");

  function pagar() {
    iniciarTransicion(async () => {
      const resultado = await pagarOcurrenciaAction({
        ocurrenciaId,
        metodoPagoId,
        valor,
        fechaPago,
        observaciones,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setAbierto(false);
      toast.success("Pago registrado y movimiento creado.");
      router.refresh();
    });
  }

  function omitir() {
    iniciarTransicion(async () => {
      const resultado = await cambiarEstadoOcurrenciaAction({ id: ocurrenciaId, omitir: true });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Ocurrencia omitida.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          size={compacto ? "sm" : "default"}
          variant={compacto ? "outline" : "default"}
          onClick={() => setAbierto(true)}
          disabled={metodosPago.length === 0}
        >
          <CheckCircle2 className="size-4" aria-hidden /> Pagar
        </Button>
        <Button
          size={compacto ? "sm" : "default"}
          variant="ghost"
          onClick={omitir}
          disabled={pendiente}
          aria-label={`Omitir ${concepto}`}
          title="Omitir esta ocurrencia"
        >
          <SkipForward className="size-4" aria-hidden />
        </Button>
      </div>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago de «{concepto}»</DialogTitle>
            <DialogDescription>
              Se crea el movimiento asociado con la categoría y el proyecto de la obligación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`valor-${ocurrenciaId}`}>Valor pagado</Label>
              <Input
                id={`valor-${ocurrenciaId}`}
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Se propone el valor estimado; ajústalo si el real fue distinto.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`fecha-${ocurrenciaId}`}>Fecha de pago</Label>
              <Input
                id={`fecha-${ocurrenciaId}`}
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`metodo-${ocurrenciaId}`}>Método de pago</Label>
              <Select value={metodoPagoId} onValueChange={(v) => setMetodoPagoId(v ?? "")}>
                <SelectTrigger id={`metodo-${ocurrenciaId}`} className="w-full">
                  <SelectValue placeholder="Selecciona un método" />
                </SelectTrigger>
                <SelectContent>
                  {metodosPago.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`obs-${ocurrenciaId}`}>Observaciones</Label>
              <Textarea
                id={`obs-${ocurrenciaId}`}
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={pagar} disabled={pendiente || !metodoPagoId}>
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
