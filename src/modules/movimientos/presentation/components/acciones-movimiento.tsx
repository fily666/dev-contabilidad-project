"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, MoreHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import type { EstadoMovimiento } from "@/shared/domain/enumeraciones";
import type { MetodoPagoVista } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import { anularMovimientoAction, marcarPagadoAction } from "../actions";

type Props = {
  id: string;
  estado: EstadoMovimiento;
  metodosPago: MetodoPagoVista[];
  hoy: string;
};

/** RF-22, RF-26. */
export function AccionesMovimiento({ id, estado, metodosPago, hoy }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [anulacionAbierta, setAnulacionAbierta] = useState(false);
  const [fechaPago, setFechaPago] = useState(hoy);
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPago[0]?.id ?? "");
  const [motivo, setMotivo] = useState("");

  if (estado === "anulado") {
    return <span className="text-xs text-muted-foreground">Anulado</span>;
  }

  function registrarPago() {
    iniciarTransicion(async () => {
      const resultado = await marcarPagadoAction({ id, fechaPago, metodoPagoId });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setPagoAbierto(false);
      toast.success("Pago registrado.");
      router.refresh();
    });
  }

  function anular() {
    iniciarTransicion(async () => {
      const resultado = await anularMovimientoAction({ id, motivo });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setAnulacionAbierta(false);
      setMotivo("");
      toast.success("Movimiento anulado.");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label="Acciones del movimiento" />}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {estado !== "pagado" ? (
            <DropdownMenuItem onClick={() => setPagoAbierto(true)}>
              <CheckCircle2 className="size-4" aria-hidden /> Registrar pago
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={() => setAnulacionAbierta(true)}>
            <Ban className="size-4" aria-hidden /> Anular
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pagoAbierto} onOpenChange={setPagoAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              Al registrar el pago, el movimiento entra en el flujo de caja ejecutado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`fechaPago-${id}`}>Fecha de pago</Label>
              <Input
                id={`fechaPago-${id}`}
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`metodo-${id}`}>Método de pago</Label>
              <Select value={metodoPagoId} onValueChange={(v) => setMetodoPagoId(v ?? "")}>
                <SelectTrigger id={`metodo-${id}`} className="w-full">
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
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagoAbierto(false)}>
              Cancelar
            </Button>
            <Button onClick={registrarPago} disabled={pendiente || !metodoPagoId}>
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={anulacionAbierta} onOpenChange={setAnulacionAbierta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular movimiento</DialogTitle>
            <DialogDescription>
              El registro se conserva para trazabilidad, pero deja de contar en todas las cifras.
              Indica el motivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`motivo-${id}`}>Motivo</Label>
            <Textarea
              id={`motivo-${id}`}
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Registrado por error, valor equivocado…"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAnulacionAbierta(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={anular}
              disabled={pendiente || motivo.trim().length < 3}
            >
              Anular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
