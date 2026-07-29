"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import type { ConfiguracionTipoProyecto } from "../../domain/tipo-proyecto.entity";
import { actualizarProyectoAction, crearProyectoAction } from "../actions";
import { esquemaCrearProyecto } from "../schemas";
import { CamposDinamicos } from "./campos-dinamicos";

export type OpcionTipoProyecto = {
  id: string;
  nombre: string;
  configuracion: ConfiguracionTipoProyecto;
};

/**
 * Formulario y Server Action comparten el esquema (§8.7). La entrada son los
 * valores del formulario; la salida ya viene normalizada por el esquema.
 */
type ValoresFormulario = z.input<typeof esquemaCrearProyecto>;
type SalidaFormulario = z.output<typeof esquemaCrearProyecto>;

type Props = {
  tipos: OpcionTipoProyecto[];
  hoy: string;
  /** Si se recibe, el formulario edita en lugar de crear. */
  proyecto?: {
    id: string;
    tipoProyectoId: string;
    nombre: string;
    descripcion: string | null;
    fechaInicio: string;
    fechaFin: string | null;
    atributos: Record<string, unknown>;
  };
};

/** RF-10, RF-12, RF-14. */
export function FormularioProyecto({ tipos, hoy, proyecto }: Props) {
  const router = useRouter();
  const editando = !!proyecto;
  const [tipoSeleccionado, setTipoSeleccionado] = useState(
    proyecto?.tipoProyectoId ?? tipos[0]?.id ?? "",
  );

  const formulario = useForm<ValoresFormulario, unknown, SalidaFormulario>({
    resolver: zodResolver(esquemaCrearProyecto),
    defaultValues: {
      tipoProyectoId: tipoSeleccionado,
      nombre: proyecto?.nombre ?? "",
      descripcion: proyecto?.descripcion ?? "",
      fechaInicio: proyecto?.fechaInicio ?? hoy,
      fechaFin: proyecto?.fechaFin ?? "",
      atributos: proyecto?.atributos ?? {},
    },
  });

  const configuracion = useMemo(
    () => tipos.find((t) => t.id === tipoSeleccionado)?.configuracion,
    [tipos, tipoSeleccionado],
  );

  async function enviar(datos: SalidaFormulario) {
    const resultado = editando
      ? await actualizarProyectoAction({ ...datos, id: proyecto.id })
      : await crearProyectoAction(datos);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      for (const [campo, mensajes] of Object.entries(resultado.camposConError ?? {})) {
        formulario.setError(campo as keyof ValoresFormulario, { message: mensajes[0] });
      }
      return;
    }

    toast.success(editando ? "Proyecto actualizado." : "Proyecto creado.");
    router.push(`/proyectos/${resultado.data.id}`);
    router.refresh();
  }

  const errores = formulario.formState.errors;
  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editando ? "Editar proyecto" : "Nuevo proyecto"}</CardTitle>
        <CardDescription>
          Cada proyecto es una unidad financiera independiente: su inversión, sus gastos y sus
          ingresos se calculan por separado.
        </CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tipoProyectoId">
                Tipo de proyecto <span className="text-destructive">*</span>
              </Label>
              <Select
                value={tipoSeleccionado}
                onValueChange={(valor) => {
                  setTipoSeleccionado(valor ?? "");
                  formulario.setValue("tipoProyectoId", valor ?? "", { shouldValidate: true });
                  formulario.setValue("atributos", {});
                }}
              >
                <SelectTrigger id="tipoProyectoId" className="w-full">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((tipo) => (
                    <SelectItem key={tipo.id} value={tipo.id}>
                      {tipo.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errores.tipoProyectoId ? (
                <p className="text-sm text-destructive">{errores.tipoProyectoId.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                placeholder="Apartamento 401, Moto XR 190…"
                aria-invalid={!!errores.nombre}
                {...formulario.register("nombre")}
              />
              {errores.nombre ? (
                <p className="text-sm text-destructive">{errores.nombre.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaInicio">
                Fecha de inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fechaInicio"
                type="date"
                aria-invalid={!!errores.fechaInicio}
                {...formulario.register("fechaInicio")}
              />
              {errores.fechaInicio ? (
                <p className="text-sm text-destructive">{errores.fechaInicio.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fechaFin">Fecha de cierre</Label>
              <Input
                id="fechaFin"
                type="date"
                aria-invalid={!!errores.fechaFin}
                {...formulario.register("fechaFin")}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Déjala vacía si sigue vigente.
              </p>
              {errores.fechaFin ? (
                <p className="text-sm text-destructive">{errores.fechaFin.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              rows={3}
              placeholder="Para qué es este proyecto, dónde está, qué incluye…"
              {...formulario.register("descripcion")}
            />
          </div>

          {configuracion ? (
            <CamposDinamicos
              atributos={configuracion.atributos}
              register={formulario.register}
              errores={errores}
              valores={proyecto?.atributos}
              alCambiarBooleano={(clave, valor) =>
                formulario.setValue(`atributos.${clave}` as `atributos.${string}`, valor)
              }
            />
          ) : null}
        </CardContent>

        <div className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end">
          <EnlaceBoton
            href={editando ? `/proyectos/${proyecto.id}` : "/proyectos"}
            variant="ghost"
            type="button"
          >
            Cancelar
          </EnlaceBoton>
          <Button type="submit" disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {editando ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
