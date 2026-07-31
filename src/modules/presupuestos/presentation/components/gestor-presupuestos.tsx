"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Copy, Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Textarea } from "@/shared/ui/textarea";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { MedidorLineal } from "@/shared/ui/viz/medidor-lineal";
import { cn } from "@/shared/utils/cn";
import { formatearDinero, formatearFecha, formatearPorcentaje } from "@/shared/utils/formato";
import type { CategoriaConRuta } from "@/modules/categorias/domain/categoria.repository";
import { nivelDeAlerta, type NivelAlerta } from "../../domain/alertas";
import { periodoAnual, periodoMensual } from "../../domain/presupuesto.entity";
import type { EjecucionPresupuesto } from "../../domain/presupuesto.repository";
import {
  copiarPresupuestosAction,
  crearPresupuestoAction,
  eliminarPresupuestoAction,
} from "../actions";

const GLOBAL = "__global__";

/** RF-82: el color dice si el presupuesto está sano antes de leer la cifra. */
const CLASES_ALERTA: Record<NivelAlerta, string> = {
  ok: "border-success/30 bg-success-soft text-success-foreground",
  aviso: "border-warning/40 bg-warning-soft text-warning-foreground",
  excedido: "border-destructive/40 bg-danger-soft text-destructive",
};

const ETIQUETA_ALERTA: Record<NivelAlerta, string> = {
  ok: "En rango",
  aviso: "Sobre el 80 %",
  excedido: "Excedido",
};

const SERIE_ALERTA: Record<NivelAlerta, 1 | 2 | 3> = { ok: 1, aviso: 3, excedido: 2 };

type Props = {
  filas: EjecucionPresupuesto[];
  proyectos: Array<{ id: string; nombre: string }>;
  categorias: CategoriaConRuta[];
  hoy: string;
  formatoFecha?: string;
};

/** RF-80 a RF-83. */
export function GestorPresupuestos({ filas, proyectos, categorias, hoy, formatoFecha }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const mesActual = hoy.slice(0, 7);

  const [borrador, setBorrador] = useState({
    proyectoId: GLOBAL,
    categoriaId: "",
    periodicidad: "mensual" as "mensual" | "anual",
    mes: mesActual,
    anio: String(Number(hoy.slice(0, 4))),
    valorPlaneado: "",
    notas: "",
  });

  // Los presupuestos son de gasto: una categoría de ingreso no tiene plan que
  // ejecutar (RF-81).
  const categoriasDeGasto = categorias.filter((c) => c.naturaleza !== "ingreso");

  function periodoDelBorrador() {
    return borrador.periodicidad === "mensual"
      ? periodoMensual(borrador.mes)
      : periodoAnual(Number(borrador.anio));
  }

  function crear() {
    iniciarTransicion(async () => {
      let periodo: { inicio: string; fin: string };
      try {
        periodo = periodoDelBorrador();
      } catch {
        toast.error("El periodo no es válido.");
        return;
      }

      const resultado = await crearPresupuestoAction({
        proyectoId: borrador.proyectoId === GLOBAL ? "" : borrador.proyectoId,
        categoriaId: borrador.categoriaId,
        periodoInicio: periodo.inicio,
        periodoFin: periodo.fin,
        valorPlaneado: borrador.valorPlaneado,
        notas: borrador.notas,
      });

      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setAbierto(false);
      setBorrador({ ...borrador, categoriaId: "", valorPlaneado: "", notas: "" });
      toast.success("Presupuesto creado.");
      router.refresh();
    });
  }

  function copiar(fila: EjecucionPresupuesto) {
    iniciarTransicion(async () => {
      const resultado = await copiarPresupuestosAction({
        proyectoId: fila.proyectoId ?? "",
        periodoInicio: fila.periodoInicio,
        periodoFin: fila.periodoFin,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(
        `${resultado.data.copiados} copiado(s) al periodo ${resultado.data.destino}` +
          (resultado.data.omitidos > 0 ? `, ${resultado.data.omitidos} ya existían.` : "."),
      );
      router.refresh();
    });
  }

  function eliminar(fila: EjecucionPresupuesto) {
    iniciarTransicion(async () => {
      const resultado = await eliminarPresupuestoAction({ id: fila.presupuestoId });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Presupuesto eliminado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Planeado contra real por categoría y periodo. El gasto de las subcategorías cuenta dentro
          de la categoría presupuestada.
        </p>
        <Button onClick={() => setAbierto(true)}>
          <Plus className="size-4" aria-hidden /> Nuevo presupuesto
        </Button>
      </div>

      {filas.length === 0 ? (
        <EstadoVacio
          icono={<AlertTriangle className="size-8" />}
          titulo="Sin presupuestos"
          descripcion="Define cuánto esperas gastar en una categoría y el sistema avisa al 80 % y al 100 %."
        />
      ) : (
        <div className="panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Proyecto</TableHead>
                <TableHead className="w-40">Periodo</TableHead>
                <TableHead className="text-right">Planeado</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead className="text-right">Desviación</TableHead>
                <TableHead className="w-44">Ejecución</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => {
                const nivel = nivelDeAlerta(fila.ejecucion);
                return (
                  <TableRow key={fila.presupuestoId}>
                    <TableCell className="max-w-48">
                      <p className="truncate font-medium">{fila.categoria}</p>
                      <p className="text-xs text-muted-foreground">
                        {fila.movimientos} movimiento(s)
                      </p>
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                      {fila.proyecto ?? "Global"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {formatearFecha(fila.periodoInicio, formatoFecha)} –{" "}
                      {formatearFecha(fila.periodoFin, formatoFecha)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearDinero(fila.valorPlaneado, fila.moneda)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatearDinero(fila.valorReal, fila.moneda)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        fila.desviacion > 0 ? "text-destructive" : "text-success",
                      )}
                    >
                      {formatearDinero(fila.desviacion, fila.moneda)}
                    </TableCell>
                    <TableCell>
                      <MedidorLineal
                        etiqueta={formatearPorcentaje(fila.ejecucion, 0)}
                        razon={fila.ejecucion === null ? null : Math.min(1, fila.ejecucion)}
                        serie={nivel ? SERIE_ALERTA[nivel] : 1}
                      />
                      {nivel ? (
                        <Badge variant="outline" className={cn("mt-1", CLASES_ALERTA[nivel])}>
                          {ETIQUETA_ALERTA[nivel]}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Copiar al periodo siguiente"
                          title="Copiar al periodo siguiente"
                          disabled={pendiente}
                          onClick={() => copiar(fila)}
                        >
                          <Copy className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar presupuesto"
                          disabled={pendiente}
                          onClick={() => eliminar(fila)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo presupuesto</DialogTitle>
            <DialogDescription>
              Por proyecto o global, mensual o anual. Un presupuesto por categoría y periodo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="presupuesto-proyecto">Proyecto</Label>
                <Select
                  value={borrador.proyectoId}
                  onValueChange={(v) => setBorrador({ ...borrador, proyectoId: v ?? GLOBAL })}
                >
                  <SelectTrigger id="presupuesto-proyecto" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL}>Global (todos)</SelectItem>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="presupuesto-categoria">Categoría</Label>
                <Select
                  value={borrador.categoriaId}
                  onValueChange={(v) => setBorrador({ ...borrador, categoriaId: v ?? "" })}
                >
                  <SelectTrigger id="presupuesto-categoria" className="w-full">
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {categoriasDeGasto.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.ruta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="presupuesto-periodicidad">Periodicidad</Label>
                <Select
                  value={borrador.periodicidad}
                  onValueChange={(v) =>
                    setBorrador({
                      ...borrador,
                      periodicidad: (v ?? "mensual") as "mensual" | "anual",
                    })
                  }
                >
                  <SelectTrigger id="presupuesto-periodicidad" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {borrador.periodicidad === "mensual" ? (
                <div className="space-y-2">
                  <Label htmlFor="presupuesto-mes">Mes</Label>
                  <Input
                    id="presupuesto-mes"
                    type="month"
                    value={borrador.mes}
                    onChange={(e) => setBorrador({ ...borrador, mes: e.target.value })}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="presupuesto-anio">Año</Label>
                  <Input
                    id="presupuesto-anio"
                    inputMode="numeric"
                    value={borrador.anio}
                    onChange={(e) => setBorrador({ ...borrador, anio: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="presupuesto-valor">Valor planeado</Label>
                <Input
                  id="presupuesto-valor"
                  inputMode="decimal"
                  value={borrador.valorPlaneado}
                  onChange={(e) => setBorrador({ ...borrador, valorPlaneado: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="presupuesto-notas">Notas</Label>
              <Textarea
                id="presupuesto-notas"
                rows={2}
                value={borrador.notas}
                onChange={(e) => setBorrador({ ...borrador, notas: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={crear}
              disabled={pendiente || borrador.categoriaId === "" || borrador.valorPlaneado === ""}
            >
              {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
