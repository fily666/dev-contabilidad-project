"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Checkbox } from "@/shared/ui/checkbox";

import { formatearFecha } from "@/shared/utils/formato";

import {
  CANALES_DISPONIBLES,
  FORMATOS_FECHA,
  HORIZONTE_PROYECCION_MAXIMO,
  HORIZONTE_PROYECCION_MINIMO,
  type Ajustes,
  type CanalAviso,
  type FormatoFecha,
} from "../../domain/sesion";
import { actualizarAjustesAction } from "../actions";
import { esquemaAjustes, type DatosAjustes } from "../schemas";

const ZONAS = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/New_York",
  "Europe/Madrid",
  "UTC",
];

/** Fecha de muestra para que la opcion se lea como se vera, no como patron. */
const EJEMPLO = "2026-02-05";

const CAMPOS = [
  "moneda",
  "zonaHoraria",
  "formatoFecha",
  "horizonteProyeccionMeses",
  "canalesNotificacion",
  "diasAvisoPorOmision",
  "emailDestino",
] as const;

export function FormularioAjustes({ ajustes }: { ajustes: Ajustes }) {
  const formulario = useForm<DatosAjustes, unknown, DatosAjustes>({
    resolver: zodResolver(esquemaAjustes),
    defaultValues: {
      moneda: ajustes.moneda,
      zonaHoraria: ajustes.zonaHoraria,
      formatoFecha: ajustes.formatoFecha,
      horizonteProyeccionMeses: ajustes.horizonteProyeccionMeses,
      canalesNotificacion: ajustes.canalesNotificacion,
      diasAvisoPorOmision: ajustes.diasAvisoPorOmision.join(", "),
      emailDestino: ajustes.emailDestino ?? "",
    },
  });

  async function enviar(datos: DatosAjustes) {
    const resultado = await actualizarAjustesAction(datos);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      for (const [campo, mensajes] of Object.entries(resultado.camposConError ?? {})) {
        if ((CAMPOS as readonly string[]).includes(campo)) {
          formulario.setError(campo as (typeof CAMPOS)[number], { message: mensajes[0] });
        }
      }
      return;
    }

    toast.success("Preferencias guardadas.");
    formulario.reset(datos);
  }

  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias</CardTitle>
        <CardDescription>
          La zona horaria decide a qué mes contable pertenece cada movimiento; en Colombia son cinco
          horas de diferencia con UTC y a fin de mes eso cambia el cierre. El horizonte gobierna
          hasta dónde llegan las proyecciones y las ocurrencias que se generan.
        </CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="moneda">Moneda</Label>
            <Input
              id="moneda"
              maxLength={3}
              className="uppercase"
              aria-invalid={!!formulario.formState.errors.moneda}
              {...formulario.register("moneda")}
            />
            {formulario.formState.errors.moneda ? (
              <p className="text-sm text-destructive">
                {formulario.formState.errors.moneda.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="zonaHoraria">Zona horaria</Label>
            <Select
              value={formulario.watch("zonaHoraria")}
              onValueChange={(valor) =>
                formulario.setValue("zonaHoraria", valor ?? ajustes.zonaHoraria, {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="zonaHoraria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZONAS.map((zona) => (
                  <SelectItem key={zona} value={zona}>
                    {zona}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* RF-101: formato de fecha. */}
          <div className="space-y-2">
            <Label htmlFor="formatoFecha">Formato de fecha</Label>
            <Select
              value={formulario.watch("formatoFecha")}
              onValueChange={(valor) =>
                formulario.setValue(
                  "formatoFecha",
                  (valor as FormatoFecha) ?? ajustes.formatoFecha,
                  {
                    shouldDirty: true,
                  },
                )
              }
            >
              <SelectTrigger id="formatoFecha">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATOS_FECHA.map((formato) => (
                  <SelectItem key={formato} value={formato}>
                    {formatearFecha(EJEMPLO, formato)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* RF-101: horizonte de proyección. */}
          <div className="space-y-2">
            <Label htmlFor="horizonteProyeccionMeses">Horizonte de proyección (meses)</Label>
            <Input
              id="horizonteProyeccionMeses"
              type="number"
              inputMode="numeric"
              min={HORIZONTE_PROYECCION_MINIMO}
              max={HORIZONTE_PROYECCION_MAXIMO}
              aria-invalid={!!formulario.formState.errors.horizonteProyeccionMeses}
              {...formulario.register("horizonteProyeccionMeses")}
            />
            {formulario.formState.errors.horizonteProyeccionMeses ? (
              <p className="text-sm text-destructive">
                {formulario.formState.errors.horizonteProyeccionMeses.message}
              </p>
            ) : null}
          </div>

          {/* RF-102: canales y anticipación por omisión. */}
          <div className="space-y-3 sm:col-span-2">
            <div>
              <Label>Canales de notificación</Label>
              <p className="text-xs text-muted-foreground">
                «En la aplicación» siempre funciona. El correo necesita además un destinatario y las
                credenciales de envío configuradas en el entorno.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              {CANALES_DISPONIBLES.map((canal) => {
                const activos = (formulario.watch("canalesNotificacion") ?? []) as CanalAviso[];
                return (
                  <label key={canal} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={activos.includes(canal)}
                      onCheckedChange={(marcado) =>
                        formulario.setValue(
                          "canalesNotificacion",
                          marcado === true
                            ? [...activos, canal]
                            : activos.filter((c) => c !== canal),
                          { shouldDirty: true },
                        )
                      }
                    />
                    {canal === "email" ? "Correo" : "En la aplicación"}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diasAvisoPorOmision">Días de aviso por omisión</Label>
            <Input
              id="diasAvisoPorOmision"
              placeholder="5, 1"
              aria-invalid={!!formulario.formState.errors.diasAvisoPorOmision}
              {...formulario.register("diasAvisoPorOmision")}
            />
            <p className="text-xs text-muted-foreground">
              Se usan cuando la obligación no declara los suyos (RF-53).
            </p>
            {formulario.formState.errors.diasAvisoPorOmision ? (
              <p className="text-sm text-destructive">
                {formulario.formState.errors.diasAvisoPorOmision.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emailDestino">Correo para avisos</Label>
            <Input
              id="emailDestino"
              type="email"
              placeholder="tu@correo.com"
              aria-invalid={!!formulario.formState.errors.emailDestino}
              {...formulario.register("emailDestino")}
            />
            <p className="text-xs text-muted-foreground">
              Vacío desactiva el correo aunque el canal esté marcado.
            </p>
            {formulario.formState.errors.emailDestino ? (
              <p className="text-sm text-destructive">
                {formulario.formState.errors.emailDestino.message}
              </p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="mt-6">
          <Button type="submit" disabled={enviando || !formulario.formState.isDirty}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Guardar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
