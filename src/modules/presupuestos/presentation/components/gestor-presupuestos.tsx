"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
import { CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { MedidorLineal } from "@/shared/ui/viz/medidor-lineal";
import type { TonoSemantico } from "@/shared/ui/viz/definiciones";
import { cn } from "@/shared/utils/cn";
import { formatearDinero, formatearFecha, formatearPorcentaje } from "@/shared/utils/formato";
import type { CategoriaConRuta } from "@/modules/categorias/domain/categoria.repository";
import { categoriasDelTipo, sirveParaTipo } from "@/modules/categorias/domain/catalogo";
import { SelectorCategoria } from "@/modules/categorias/presentation/components/selector-categoria";
import { nivelDeAlerta, type NivelAlerta } from "../../domain/alertas";
import { periodoAnual, periodoMensual } from "../../domain/presupuesto.entity";
import type { EjecucionPresupuesto } from "../../domain/presupuesto.repository";
import {
  actualizarPresupuestoAction,
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

/**
 * RF-82 en la escala SEMÁNTICA, no en la categórica.
 *
 * El nivel de alerta es estado, y el estado NO se pinta con la paleta de series:
 * mapearlo a las ranuras 1/3/2 pintaría un presupuesto excedido con el azul de los
 * egresos mientras su insignia, en la misma fila, lo pinta en rojo. Medidor e
 * insignia leen de los mismos tokens del tema.
 */
const TONO_ALERTA: Record<NivelAlerta, TonoSemantico> = {
  ok: "ok",
  aviso: "aviso",
  excedido: "critico",
};

type Props = {
  filas: EjecucionPresupuesto[];
  proyectos: Array<{ id: string; nombre: string; tipoProyectoId?: string }>;
  categorias: CategoriaConRuta[];
  /** Nombre de cada tipo, para distinguir raices homonimas en el plan global. */
  nombrePorTipo?: Record<string, string>;
  hoy: string;
  formatoFecha?: string;
};

/** RF-80 a RF-83. */
export function GestorPresupuestos({
  filas,
  proyectos,
  categorias,
  nombrePorTipo,
  hoy,
  formatoFecha,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [abierto, setAbierto] = useState(false);
  /**
   * RF-80: corregir un presupuesto.
   *
   * `ActualizarPresupuesto` estaba escrita y probada sin consumidor: el gestor solo
   * creaba, copiaba y eliminaba. Corregir un valor mal teclado obligaba a eliminar
   * y volver a crear, y eliminar un presupuesto pierde su historia de ejecución.
   */
  const [editando, setEditando] = useState<string | null>(null);
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
  // ejecutar (RF-81). Con proyecto elegido se acota además a su tipo; el
  // presupuesto global abarca todos los tipos y conserva el catálogo entero.
  const tipoDelProyecto = proyectos.find((p) => p.id === borrador.proyectoId)?.tipoProyectoId;
  const categoriasDeGasto = categoriasDelTipo(categorias, tipoDelProyecto).filter(
    (c) => c.naturaleza !== "ingreso",
  );

  function periodoDelBorrador() {
    return borrador.periodicidad === "mensual"
      ? periodoMensual(borrador.mes)
      : periodoAnual(Number(borrador.anio));
  }

  function abrirAlta() {
    setEditando(null);
    setBorrador({
      proyectoId: GLOBAL,
      categoriaId: "",
      periodicidad: "mensual",
      mes: mesActual,
      anio: String(Number(hoy.slice(0, 4))),
      valorPlaneado: "",
      notas: "",
    });
    setAbierto(true);
  }

  /** El periodo guardado es un rango; aquí se reconstruye la periodicidad. */
  function abrirEdicion(fila: EjecucionPresupuesto) {
    const anual = fila.periodoInicio.endsWith("-01-01") && fila.periodoFin.endsWith("-12-31");
    setEditando(fila.presupuestoId);
    setBorrador({
      proyectoId: fila.proyectoId ?? GLOBAL,
      categoriaId: fila.categoriaId,
      periodicidad: anual ? "anual" : "mensual",
      mes: fila.periodoInicio.slice(0, 7),
      anio: fila.periodoInicio.slice(0, 4),
      valorPlaneado: String(fila.valorPlaneado),
      notas: "",
    });
    setAbierto(true);
  }

  function guardar() {
    iniciarTransicion(async () => {
      let periodo: { inicio: string; fin: string };
      try {
        periodo = periodoDelBorrador();
      } catch {
        toast.error("El periodo no es válido.");
        return;
      }

      const datos = {
        proyectoId: borrador.proyectoId === GLOBAL ? "" : borrador.proyectoId,
        categoriaId: borrador.categoriaId,
        periodoInicio: periodo.inicio,
        periodoFin: periodo.fin,
        valorPlaneado: borrador.valorPlaneado,
        notas: borrador.notas,
      };
      const resultado = editando
        ? await actualizarPresupuestoAction({ ...datos, id: editando })
        : await crearPresupuestoAction(datos);

      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setAbierto(false);
      setEditando(null);
      setBorrador({ ...borrador, categoriaId: "", valorPlaneado: "", notas: "" });
      toast.success(editando ? "Presupuesto actualizado." : "Presupuesto creado.");
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
      {/*
        La sección tenía un párrafo suelto donde el resto del producto pone un
        título: era el único bloque de datos sin nombre, así que la tabla que sigue
        no se podía referenciar ni enlazar.
      */}
      <CabeceraSeccion
        titulo="Partidas presupuestales"
        descripcion="Planeado contra real por categoría y periodo. El gasto de las subcategorías cuenta dentro de la categoría presupuestada."
        acciones={
          <Button onClick={abrirAlta}>
            <Plus className="size-4" aria-hidden /> Nuevo presupuesto
          </Button>
        }
      />

      {filas.length === 0 ? (
        <EstadoVacio
          icono={<AlertTriangle className="size-8" />}
          titulo="Sin presupuestos"
          descripcion="Define cuánto esperas gastar en una categoría y el sistema avisa al 80 % y al 100 %."
          // El estado vacío lleva su propia acción: el botón de arriba queda a 300 px
          // del texto que dice qué hacer, y con la tabla vacía es el único paso posible.
          accion={
            <Button onClick={abrirAlta}>
              <Plus className="size-4" aria-hidden /> Crear el primer presupuesto
            </Button>
          }
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
                        tono={nivel ? TONO_ALERTA[nivel] : "ok"}
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
                          aria-label="Editar presupuesto"
                          title="Editar"
                          disabled={pendiente}
                          onClick={() => abrirEdicion(fila)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
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
            <DialogTitle>{editando ? "Editar presupuesto" : "Nuevo presupuesto"}</DialogTitle>
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
                  onValueChange={(v) => {
                    // Cambiar de proyecto puede dejar la categoría fuera de su tipo.
                    const proyectoId = v ?? GLOBAL;
                    const tipo = proyectos.find((p) => p.id === proyectoId)?.tipoProyectoId;
                    const sigue = sirveParaTipo(categorias, borrador.categoriaId, tipo);
                    setBorrador({
                      ...borrador,
                      proyectoId,
                      categoriaId: sigue ? borrador.categoriaId : "",
                    });
                  }}
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

              <SelectorCategoria
                id="presupuesto-categoria"
                categorias={categoriasDeGasto}
                nombrePorTipo={nombrePorTipo}
                valor={borrador.categoriaId}
                alCambiar={(id) => setBorrador({ ...borrador, categoriaId: id })}
              />

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
              onClick={guardar}
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
