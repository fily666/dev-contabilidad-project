"use client";

import { useRouter } from "next/navigation";
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
import { actualizarClaveAction } from "../actions";
import { esquemaActualizarClave, type DatosActualizarClave } from "../schemas";

export function FormularioActualizarClave() {
  const router = useRouter();

  const formulario = useForm<DatosActualizarClave>({
    resolver: zodResolver(esquemaActualizarClave),
    defaultValues: { clave: "", confirmacion: "" },
  });

  async function enviar(datos: DatosActualizarClave) {
    const resultado = await actualizarClaveAction(datos);
    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      return;
    }
    toast.success("Contraseña actualizada.");
    router.replace("/dashboard");
    router.refresh();
  }

  const errores = formulario.formState.errors;
  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva contraseña</CardTitle>
        <CardDescription>
          Define la contraseña con la que ingresarás a partir de ahora.
        </CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clave">Contraseña</Label>
            <Input
              id="clave"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errores.clave}
              {...formulario.register("clave")}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, con mayúscula, minúscula y número.
            </p>
            {errores.clave ? (
              <p className="text-sm text-destructive">{errores.clave.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmacion">Repetir contraseña</Label>
            <Input
              id="confirmacion"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errores.confirmacion}
              {...formulario.register("confirmacion")}
            />
            {errores.confirmacion ? (
              <p className="text-sm text-destructive">{errores.confirmacion.message}</p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="mt-6">
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Guardar contraseña
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
