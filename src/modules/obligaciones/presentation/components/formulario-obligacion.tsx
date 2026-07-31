"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { FRECUENCIAS, type Frecuencia } from "@/shared/domain/enumeraciones";
import { ETIQUETA_FRECUENCIA } from "@/shared/utils/etiquetas";
import { formatearFecha } from "@/shared/utils/formato";
import type { CategoriaConRuta } from "@/modules/categorias/domain/categoria.repository";
import { fechasDeRecurrencia, limiteDelHorizonte } from "@/modules/obligaciones/domain/recurrencia";
import { actualizarObligacionAction, crearObligacionAction } from "../actions";
import { esquemaCrearObligacion } from "../schemas";

type ValoresFormulario = z.input<typeof esquemaCrearObligacion>;
type SalidaFormulario = z.output<typeof esquemaCrearObligacion>;

export type OpcionProyectoObligacion = { id: string; nombre: string };

type Props = {
  proyectos: OpcionProyectoObligacion[];
  categorias: CategoriaConRuta[];
  hoy: string;
  horizonteMeses: number;
  formatoFecha?: string;
  proyectoFijo?: string;
  obligacion?: {
    id: string;
    proyectoId: string;
    categoriaId: string;
    concepto: string;
    valorEstimado: number;
    fechaVencimiento: string;
    frecuencia: Frecuencia;
    intervaloMeses: number | null;
    diasAviso: number[];
  };
  alTerminar?: () => void;
};

/** RF-50, RF-51, RF-53. */
export function FormularioObligacion({
  proyectos,
  categorias,
  hoy,
  horizonteMeses,
  formatoFecha,
  proyectoFijo,
  obligacion,
  alTerminar,
}: Props) {
  const router = useRouter();
  const editando = !!obligacion;

  const [frecuencia, setFrecuencia] = useState<Frecuencia>(obligacion?.frecuencia ?? "mensual");
  const [categoriaId, setCategoriaId] = useState(obligacion?.categoriaId ?? "");

  const formulario = useForm<ValoresFormulario, unknown, SalidaFormulario>({
    resolver: zodResolver(esquemaCrearObligacion),
    defaultValues: {
      proyectoId: obligacion?.proyectoId ?? proyectoFijo ?? proyectos[0]?.id ?? "",
      categoriaId: obligacion?.categoriaId ?? "",
      concepto: obligacion?.concepto ?? "",
      valorEstimado: obligacion ? String(obligacion.valorEstimado) : "",
      fechaVencimiento: obligacion?.fechaVencimiento ?? hoy,
      frecuencia: obligacion?.frecuencia ?? "mensual",
      intervaloMeses: obligacion?.intervaloMeses ?? "",
      diasAviso: (obligacion?.diasAviso ?? [5, 1]).join(", "),
      crearMovimientoAuto: false,
    },
  });

  const fechaVencimiento = formulario.watch("fechaVencimiento");
  const intervaloMeses = formulario.watch("intervaloMeses");

  /**
   * Vista previa de los vencimientos que se van a materializar. Se calcula con
   * las mismas funciones del dominio que usa la generacion (§5.6), asi que lo
   * que se muestra aqui es exactamente lo que quedara en la base.
   */
  const vencimientos = useMemo(() => {
    if (!fechaVencimiento || !/^\d{4}-\d{2}-\d{2}$/.test(String(fechaVencimiento))) return [];
    const intervalo = Number(intervaloMeses);
    return fechasDeRecurrencia({
      primera: String(fechaVencimiento),
      frecuencia,
      intervaloMeses: Number.isFinite(intervalo) && intervalo > 0 ? intervalo : null,
      limite: limiteDelHorizonte(hoy, horizonteMeses),
    }).slice(0, 6);
  }, [fechaVencimiento, frecuencia, intervaloMeses, hoy, horizonteMeses]);

  async function enviar(datos: SalidaFormulario) {
    const carga = editando ? { ...datos, id: obligacion.id } : datos;
    const resultado = editando
      ? await actualizarObligacionAction(carga)
      : await crearObligacionAction(carga);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      for (const [campo, mensajes] of Object.entries(resultado.camposConError ?? {})) {
        formulario.setError(campo as keyof ValoresFormulario, { message: mensajes[0] });
      }
      return;
    }

    toast.success(editando ? "Obligación actualizada." : "Obligación creada.");
    router.refresh();
    alTerminar?.();
  }

  const errores = formulario.formState.errors;
  const enviando = formulario.formState.isSubmitting;

  return (
    <form onSubmit={formulario.handleSubmit(enviar)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {!proyectoFijo ? (
          <div className="space-y-2">
            <Label htmlFor="proyectoId">
              Proyecto <span className="text-destructive">*</span>
            </Label>
            <Select
              defaultValue={formulario.getValues("proyectoId")}
              onValueChange={(v) =>
                formulario.setValue("proyectoId", v ?? "", { shouldValidate: true })
              }
            >
              <SelectTrigger id="proyectoId" className="w-full">
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
            {errores.proyectoId ? (
              <p className="text-sm text-destructive">{errores.proyectoId.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="categoriaId">
            Categoría <span className="text-destructive">*</span>
          </Label>
          <Select
            value={categoriaId}
            onValueChange={(v) => {
              setCategoriaId(v ?? "");
              formulario.setValue("categoriaId", v ?? "", { shouldValidate: true });
            }}
          >
            <SelectTrigger id="categoriaId" className="w-full">
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.ruta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errores.categoriaId ? (
            <p className="text-sm text-destructive">{errores.categoriaId.message}</p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="concepto">
            Concepto <span className="text-destructive">*</span>
          </Label>
          <Input
            id="concepto"
            placeholder="Cuota del crédito hipotecario, administración, SOAT…"
            aria-invalid={!!errores.concepto}
            {...formulario.register("concepto")}
          />
          {errores.concepto ? (
            <p className="text-sm text-destructive">{errores.concepto.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="valorEstimado">
            Valor estimado <span className="text-destructive">*</span>
          </Label>
          <Input
            id="valorEstimado"
            inputMode="decimal"
            placeholder="0"
            aria-invalid={!!errores.valorEstimado}
            {...formulario.register("valorEstimado")}
          />
          <p className="text-xs text-muted-foreground">
            Admite cero si el importe solo se conoce al pagar.
          </p>
          {errores.valorEstimado ? (
            <p className="text-sm text-destructive">{errores.valorEstimado.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="fechaVencimiento">
            Primer vencimiento <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fechaVencimiento"
            type="date"
            aria-invalid={!!errores.fechaVencimiento}
            {...formulario.register("fechaVencimiento")}
          />
          {errores.fechaVencimiento ? (
            <p className="text-sm text-destructive">{errores.fechaVencimiento.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="frecuencia">
            Frecuencia <span className="text-destructive">*</span>
          </Label>
          <Select
            value={frecuencia}
            onValueChange={(v) => {
              const nueva = (v ?? "mensual") as Frecuencia;
              setFrecuencia(nueva);
              formulario.setValue("frecuencia", nueva, { shouldValidate: true });
            }}
          >
            <SelectTrigger id="frecuencia" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRECUENCIAS.map((f) => (
                <SelectItem key={f} value={f}>
                  {ETIQUETA_FRECUENCIA[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {frecuencia === "personalizada" ? (
          <div className="space-y-2">
            <Label htmlFor="intervaloMeses">
              Cada cuántos meses <span className="text-destructive">*</span>
            </Label>
            <Input
              id="intervaloMeses"
              inputMode="numeric"
              placeholder="4"
              aria-invalid={!!errores.intervaloMeses}
              {...formulario.register("intervaloMeses")}
            />
            {errores.intervaloMeses ? (
              <p className="text-sm text-destructive">{errores.intervaloMeses.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="diasAviso">Días de aviso</Label>
          <Input id="diasAviso" placeholder="5, 1" {...formulario.register("diasAviso")} />
          <p className="text-xs text-muted-foreground">
            Cuántos días antes avisar. Separados por coma.
          </p>
          {errores.diasAviso ? (
            <p className="text-sm text-destructive">{errores.diasAviso.message}</p>
          ) : null}
        </div>
      </div>

      {vencimientos.length > 0 ? (
        <div className="rounded-md border p-4">
          <p className="etiqueta-dato">Próximos vencimientos que se generarán</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {vencimientos.map((fecha) => (
              <li
                key={fecha}
                className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground tabular-nums"
              >
                {formatearFecha(fecha, formatoFecha)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Horizonte de {horizonteMeses} meses, configurable en Ajustes.
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <Label htmlFor="crearMovimientoAuto" className="cursor-pointer">
            Crear el movimiento automáticamente
          </Label>
          <p className="text-xs text-muted-foreground">
            Si se activa, al vencer se registra el movimiento como pendiente en lugar de esperar el
            pago manual.
          </p>
        </div>
        <Switch
          id="crearMovimientoAuto"
          checked={formulario.watch("crearMovimientoAuto") === true}
          onCheckedChange={(marcado) => formulario.setValue("crearMovimientoAuto", marcado)}
        />
      </div>

      <div className="flex justify-end gap-2">
        {alTerminar ? (
          <Button type="button" variant="ghost" onClick={alTerminar}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {editando ? "Guardar cambios" : "Crear obligación"}
        </Button>
      </div>
    </form>
  );
}
