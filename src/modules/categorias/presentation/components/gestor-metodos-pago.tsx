"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { TIPOS_METODO_PAGO, type TipoMetodoPago } from "@/shared/domain/enumeraciones";
import { ETIQUETA_TIPO_METODO_PAGO } from "@/shared/utils/etiquetas";
import type { MetodoPago } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import {
  actualizarMetodoPagoAction,
  crearMetodoPagoAction,
  eliminarMetodoPagoAction,
} from "../actions";

/** RF-33. */
export function GestorMetodosPago({ metodos }: { metodos: MetodoPago[] }) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoMetodoPago>("transferencia");
  const [ultimosDigitos, setUltimosDigitos] = useState("");

  function crear() {
    iniciarTransicion(async () => {
      const resultado = await crearMetodoPagoAction({ nombre, tipo, ultimosDigitos });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setNombre("");
      setUltimosDigitos("");
      toast.success("Método de pago creado.");
      router.refresh();
    });
  }

  function alternar(metodo: MetodoPago) {
    iniciarTransicion(async () => {
      const resultado = await actualizarMetodoPagoAction({
        id: metodo.id,
        nombre: metodo.nombre,
        tipo: metodo.tipo,
        ultimosDigitos: metodo.ultimosDigitos,
        activo: !metodo.activo,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(id: string) {
    iniciarTransicion(async () => {
      const resultado = await eliminarMetodoPagoAction({ id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Método de pago eliminado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 p-5">
        <h3 className="font-medium">Agregar método de pago</h3>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="mp-nombre" className="text-xs">
              Nombre
            </Label>
            <Input
              id="mp-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tarjeta Visa personal"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-tipo" className="text-xs">
              Tipo
            </Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMetodoPago)}>
              <SelectTrigger id="mp-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_METODO_PAGO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ETIQUETA_TIPO_METODO_PAGO[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-digitos" className="text-xs">
              Últimos dígitos
            </Label>
            <Input
              id="mp-digitos"
              value={ultimosDigitos}
              onChange={(e) => setUltimosDigitos(e.target.value)}
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
            />
          </div>
        </div>

        <Button onClick={crear} disabled={pendiente || nombre.trim().length === 0}>
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Agregar
        </Button>
      </div>

      <ul className="panel divide-y divide-border/60">
        {metodos.map((metodo) => (
          <li key={metodo.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {metodo.nombre}
                {metodo.ultimosDigitos ? (
                  <span className="text-muted-foreground"> ···{metodo.ultimosDigitos}</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {ETIQUETA_TIPO_METODO_PAGO[metodo.tipo]}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={metodo.activo}
                onCheckedChange={() => alternar(metodo)}
                disabled={pendiente}
                aria-label={metodo.activo ? "Desactivar" : "Activar"}
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={pendiente}
                onClick={() => eliminar(metodo.id)}
                aria-label="Eliminar método de pago"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
