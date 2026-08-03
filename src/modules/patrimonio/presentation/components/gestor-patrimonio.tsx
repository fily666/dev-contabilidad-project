"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, TrendingUp, Trash2 } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CabeceraSeccion } from "@/shared/ui/cabeceras";
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
import { TIPOS_PASIVO, type TipoPasivo } from "../../domain/pasivo.entity";
import type { PasivoListado, ValoracionListada } from "../../domain/patrimonio.repository";
import {
  abonarACapitalAction,
  cambiarEstadoPasivoAction,
  actualizarPasivoAction,
  crearPasivoAction,
  eliminarPasivoAction,
  eliminarValoracionAction,
  registrarValoracionAction,
} from "../actions";

export const ETIQUETA_TIPO_PASIVO: Record<TipoPasivo, string> = {
  credito_hipotecario: "Crédito hipotecario",
  credito_vehiculo: "Crédito de vehículo",
  credito_libre: "Crédito de libre inversión",
  tarjeta_credito: "Tarjeta de crédito",
  otro: "Otro",
};

type Props = {
  proyectos: Array<{ id: string; nombre: string }>;
  pasivos: PasivoListado[];
  valoraciones: ValoracionListada[];
  variacion: number | null;
  hoy: string;
  formatoFecha?: string;
  /** Cuando se está dentro de un proyecto, no se pide elegirlo. */
  proyectoFijo?: string;
};

const PASIVO_VACIO = {
  nombre: "",
  tipo: "credito_hipotecario" as TipoPasivo,
  montoOriginal: "",
  saldoActual: "",
  tasaInteresEa: "",
  plazoMeses: "",
  valorCuota: "",
  fechaDesembolso: "",
};

/** RF-16, RF-17: pasivos y valoraciones del proyecto. */
export function GestorPatrimonio({
  proyectos,
  pasivos,
  valoraciones,
  variacion,
  hoy,
  formatoFecha,
  proyectoFijo,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [pasivoAbierto, setPasivoAbierto] = useState(false);
  /**
   * RF-17: corregir un pasivo.
   *
   * `ActualizarPasivo` y su Server Action estaban escritas y probadas sin ningún
   * consumidor: el gestor solo registraba. Y el saldo de un crédito es el dato que
   * más se corrige del producto —baja cada mes—, así que la única salida era
   * eliminar y volver a crear, perdiendo el historial de abonos.
   *
   * `null` es «alta»; un id es «edición». El mismo diálogo sirve para las dos, que
   * es lo que evita mantener dos formularios con los mismos nueve campos.
   */
  const [editandoPasivo, setEditandoPasivo] = useState<string | null>(null);
  const [valoracionAbierta, setValoracionAbierta] = useState(false);
  const [abonando, setAbonando] = useState<PasivoListado | null>(null);
  const [abono, setAbono] = useState("");

  const [pasivo, setPasivo] = useState({
    ...PASIVO_VACIO,
    proyectoId: proyectoFijo ?? proyectos[0]?.id ?? "",
    fechaDesembolso: hoy,
  });
  const [valoracion, setValoracion] = useState({
    proyectoId: proyectoFijo ?? proyectos[0]?.id ?? "",
    fecha: hoy,
    valor: "",
    fuente: "",
    notas: "",
  });

  function abrirAltaPasivo() {
    setEditandoPasivo(null);
    setPasivo({
      ...PASIVO_VACIO,
      proyectoId: proyectoFijo ?? proyectos[0]?.id ?? "",
      fechaDesembolso: hoy,
    });
    setPasivoAbierto(true);
  }

  function abrirEdicionPasivo(fila: PasivoListado) {
    setEditandoPasivo(fila.id);
    setPasivo({
      proyectoId: fila.proyectoId,
      nombre: fila.nombre,
      tipo: fila.tipo,
      montoOriginal: String(fila.montoOriginal),
      saldoActual: String(fila.saldoActual),
      tasaInteresEa: fila.tasaInteresEa === null ? "" : String(fila.tasaInteresEa),
      plazoMeses: fila.plazoMeses === null ? "" : String(fila.plazoMeses),
      valorCuota: fila.valorCuota === null ? "" : String(fila.valorCuota),
      fechaDesembolso: fila.fechaDesembolso,
    });
    setPasivoAbierto(true);
  }

  function ejecutar(accion: () => Promise<{ ok: boolean; mensaje?: string }>, exito: string) {
    iniciarTransicion(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error(resultado.mensaje ?? "No se pudo completar la operación.");
        return;
      }
      toast.success(exito);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* ─── Pasivos (RF-17) ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <CabeceraSeccion
          titulo="Pasivos"
          descripcion="Créditos y deudas del proyecto. El saldo se actualiza al abonar a capital."
          acciones={
            <Button onClick={abrirAltaPasivo} disabled={proyectos.length === 0}>
              <Plus className="size-4" aria-hidden /> Nuevo pasivo
            </Button>
          }
        />

        {pasivos.length === 0 ? (
          <EstadoVacio
            titulo="Sin pasivos registrados"
            descripcion="Registra el crédito hipotecario o del vehículo para ver el patrimonio neto."
          />
        ) : (
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Monto original</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-40">Amortizado</TableHead>
                  <TableHead className="text-right">Cuota</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-44" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pasivos.map((fila) => (
                  <TableRow key={fila.id} className={cn(!fila.activo && "opacity-60")}>
                    <TableCell className="max-w-48">
                      <p className="truncate font-medium">{fila.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fila.proyectoNombre} · {formatearFecha(fila.fechaDesembolso, formatoFecha)}
                        {fila.tasaInteresEa !== null
                          ? ` · ${formatearPorcentaje(fila.tasaInteresEa, 2)} E.A.`
                          : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{ETIQUETA_TIPO_PASIVO[fila.tipo]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatearDinero(fila.montoOriginal, fila.moneda)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatearDinero(fila.saldoActual, fila.moneda)}
                    </TableCell>
                    <TableCell>
                      <MedidorLineal
                        etiqueta="Pagado"
                        razon={fila.amortizado}
                        valorTexto={formatearPorcentaje(fila.amortizado, 0)}
                        serie={1}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.valorCuota === null
                        ? "—"
                        : formatearDinero(fila.valorCuota, fila.moneda)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{fila.activo ? "Vigente" : "Cerrado"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {fila.activo ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setAbonando(fila);
                              setAbono("");
                            }}
                          >
                            Abonar
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendiente}
                          onClick={() =>
                            ejecutar(
                              () =>
                                cambiarEstadoPasivoAction({ id: fila.id, activo: !fila.activo }),
                              fila.activo ? "Pasivo cerrado." : "Pasivo reactivado.",
                            )
                          }
                        >
                          {fila.activo ? "Cerrar" : "Reactivar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pendiente}
                          onClick={() => abrirEdicionPasivo(fila)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar ${fila.nombre}`}
                          disabled={pendiente}
                          onClick={() =>
                            ejecutar(
                              () => eliminarPasivoAction({ id: fila.id }),
                              "Pasivo eliminado.",
                            )
                          }
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ─── Valoraciones (RF-16) ────────────────────────────────────────── */}
      <section className="space-y-3">
        <CabeceraSeccion
          titulo="Valoraciones"
          descripcion="Valor comercial estimado en el tiempo. De aquí sale la plusvalía; no se calcula sola."
          acciones={
            <>
              {variacion !== null ? (
                <span
                  className={cn(
                    "flex items-center gap-1 text-sm tabular-nums",
                    variacion >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  <TrendingUp className="size-4" aria-hidden />
                  {formatearPorcentaje(variacion, 1)} desde la primera
                </span>
              ) : null}
              <Button onClick={() => setValoracionAbierta(true)} disabled={proyectos.length === 0}>
                <Plus className="size-4" aria-hidden /> Nueva valoración
              </Button>
            </>
          }
        />

        {valoraciones.length === 0 ? (
          <EstadoVacio
            titulo="Sin valoraciones"
            descripcion="Registra el valor comercial cuando lo conozcas: un avalúo, un precio de mercado o una oferta."
          />
        ) : (
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Fecha</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {valoraciones.map((fila) => (
                  <TableRow key={fila.id}>
                    <TableCell className="tabular-nums">
                      {formatearFecha(fila.fecha, formatoFecha)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatearDinero(fila.valor, fila.moneda)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fila.fuente ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-sm text-muted-foreground">
                      {fila.notas ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar valoración"
                        disabled={pendiente}
                        onClick={() =>
                          ejecutar(
                            () => eliminarValoracionAction({ id: fila.id }),
                            "Valoración eliminada.",
                          )
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ─── Diálogo: nuevo pasivo ───────────────────────────────────────── */}
      <Dialog open={pasivoAbierto} onOpenChange={setPasivoAbierto}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editandoPasivo ? "Editar pasivo" : "Nuevo pasivo"}</DialogTitle>
            <DialogDescription>
              El saldo inicial es el monto original si no indicas otro. La tasa se escribe como
              porcentaje efectivo anual.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            {!proyectoFijo ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="pasivo-proyecto">Proyecto</Label>
                <Select
                  value={pasivo.proyectoId}
                  onValueChange={(v) => setPasivo({ ...pasivo, proyectoId: v ?? "" })}
                >
                  <SelectTrigger id="pasivo-proyecto" className="w-full">
                    <SelectValue placeholder="Selecciona un proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="pasivo-nombre">Nombre</Label>
              <Input
                id="pasivo-nombre"
                value={pasivo.nombre}
                onChange={(e) => setPasivo({ ...pasivo, nombre: e.target.value })}
                placeholder="Crédito hipotecario Bancolombia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasivo-tipo">Tipo</Label>
              <Select
                value={pasivo.tipo}
                onValueChange={(v) => setPasivo({ ...pasivo, tipo: (v ?? "otro") as TipoPasivo })}
              >
                <SelectTrigger id="pasivo-tipo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PASIVO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ETIQUETA_TIPO_PASIVO[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasivo-monto">Monto original</Label>
              <Input
                id="pasivo-monto"
                inputMode="decimal"
                value={pasivo.montoOriginal}
                onChange={(e) => setPasivo({ ...pasivo, montoOriginal: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasivo-saldo">Saldo actual</Label>
              <Input
                id="pasivo-saldo"
                inputMode="decimal"
                value={pasivo.saldoActual}
                onChange={(e) => setPasivo({ ...pasivo, saldoActual: e.target.value })}
                placeholder="Igual al monto original"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasivo-tasa">Tasa E.A. (%)</Label>
              <Input
                id="pasivo-tasa"
                inputMode="decimal"
                value={pasivo.tasaInteresEa}
                onChange={(e) => setPasivo({ ...pasivo, tasaInteresEa: e.target.value })}
                placeholder="12,5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasivo-plazo">Plazo (meses)</Label>
              <Input
                id="pasivo-plazo"
                inputMode="numeric"
                value={pasivo.plazoMeses}
                onChange={(e) => setPasivo({ ...pasivo, plazoMeses: e.target.value })}
                placeholder="180"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasivo-cuota">Valor de la cuota</Label>
              <Input
                id="pasivo-cuota"
                inputMode="decimal"
                value={pasivo.valorCuota}
                onChange={(e) => setPasivo({ ...pasivo, valorCuota: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pasivo-fecha">Fecha de desembolso</Label>
              <Input
                id="pasivo-fecha"
                type="date"
                value={pasivo.fechaDesembolso}
                onChange={(e) => setPasivo({ ...pasivo, fechaDesembolso: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasivoAbierto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente || pasivo.nombre.trim() === "" || pasivo.montoOriginal === ""}
              onClick={() =>
                iniciarTransicion(async () => {
                  const datos = {
                    ...pasivo,
                    saldoActual:
                      pasivo.saldoActual === "" ? pasivo.montoOriginal : pasivo.saldoActual,
                  };
                  // El mismo formulario para alta y edición: nueve campos
                  // duplicados en dos diálogos eran nueve sitios donde divergir.
                  const resultado = editandoPasivo
                    ? await actualizarPasivoAction({ ...datos, id: editandoPasivo })
                    : await crearPasivoAction(datos);
                  if (!resultado.ok) {
                    toast.error(resultado.mensaje);
                    return;
                  }
                  setPasivoAbierto(false);
                  setEditandoPasivo(null);
                  setPasivo({
                    ...PASIVO_VACIO,
                    proyectoId: pasivo.proyectoId,
                    fechaDesembolso: hoy,
                  });
                  toast.success(editandoPasivo ? "Pasivo actualizado." : "Pasivo registrado.");
                  router.refresh();
                })
              }
            >
              {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Diálogo: abono a capital ────────────────────────────────────── */}
      <Dialog
        open={abonando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setAbonando(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonar a capital</DialogTitle>
            <DialogDescription>
              Baja el saldo de «{abonando?.nombre}» sin tocar el monto original. Si el saldo queda
              en cero, el pasivo se cierra.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="abono-valor">Valor del abono</Label>
            <Input
              id="abono-valor"
              inputMode="decimal"
              value={abono}
              onChange={(e) => setAbono(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Saldo actual:{" "}
              {abonando ? formatearDinero(abonando.saldoActual, abonando.moneda) : "—"}
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAbonando(null)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente || abono === ""}
              onClick={() =>
                iniciarTransicion(async () => {
                  if (!abonando) return;
                  const resultado = await abonarACapitalAction({ id: abonando.id, valor: abono });
                  if (!resultado.ok) {
                    toast.error(resultado.mensaje);
                    return;
                  }
                  setAbonando(null);
                  toast.success("Abono registrado.");
                  router.refresh();
                })
              }
            >
              Abonar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Diálogo: nueva valoración ───────────────────────────────────── */}
      <Dialog open={valoracionAbierta} onOpenChange={setValoracionAbierta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva valoración</DialogTitle>
            <DialogDescription>
              Registrar dos valoraciones el mismo día corrige la anterior en lugar de duplicarla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!proyectoFijo ? (
              <div className="space-y-2">
                <Label htmlFor="valoracion-proyecto">Proyecto</Label>
                <Select
                  value={valoracion.proyectoId}
                  onValueChange={(v) => setValoracion({ ...valoracion, proyectoId: v ?? "" })}
                >
                  <SelectTrigger id="valoracion-proyecto" className="w-full">
                    <SelectValue placeholder="Selecciona un proyecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="valoracion-fecha">Fecha</Label>
                <Input
                  id="valoracion-fecha"
                  type="date"
                  value={valoracion.fecha}
                  onChange={(e) => setValoracion({ ...valoracion, fecha: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valoracion-valor">Valor comercial</Label>
                <Input
                  id="valoracion-valor"
                  inputMode="decimal"
                  value={valoracion.valor}
                  onChange={(e) => setValoracion({ ...valoracion, valor: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valoracion-fuente">Fuente</Label>
              <Input
                id="valoracion-fuente"
                value={valoracion.fuente}
                onChange={(e) => setValoracion({ ...valoracion, fuente: e.target.value })}
                placeholder="Avalúo comercial, portal inmobiliario, oferta recibida…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valoracion-notas">Notas</Label>
              <Textarea
                id="valoracion-notas"
                rows={2}
                value={valoracion.notas}
                onChange={(e) => setValoracion({ ...valoracion, notas: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setValoracionAbierta(false)}>
              Cancelar
            </Button>
            <Button
              disabled={pendiente || valoracion.valor === ""}
              onClick={() =>
                iniciarTransicion(async () => {
                  const resultado = await registrarValoracionAction(valoracion);
                  if (!resultado.ok) {
                    toast.error(resultado.mensaje);
                    return;
                  }
                  setValoracionAbierta(false);
                  setValoracion({ ...valoracion, valor: "", fuente: "", notas: "" });
                  toast.success("Valoración registrada.");
                  router.refresh();
                })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
