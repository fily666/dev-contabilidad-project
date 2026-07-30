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

import type { Ajustes } from "../../domain/sesion";
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

export function FormularioAjustes({ ajustes }: { ajustes: Ajustes }) {
  const formulario = useForm<DatosAjustes, unknown, DatosAjustes>({
    resolver: zodResolver(esquemaAjustes),
    defaultValues: { moneda: ajustes.moneda, zonaHoraria: ajustes.zonaHoraria },
  });

  async function enviar(datos: DatosAjustes) {
    const resultado = await actualizarAjustesAction(datos);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      for (const [campo, mensajes] of Object.entries(resultado.camposConError ?? {})) {
        if (campo === "moneda" || campo === "zonaHoraria") {
          formulario.setError(campo, { message: mensajes[0] });
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
          horas de diferencia con UTC y a fin de mes eso cambia el cierre.
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
