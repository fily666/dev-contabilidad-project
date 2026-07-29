"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
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
import { registrarAction } from "../actions";
import { esquemaRegistro, type DatosRegistro } from "../schemas";

const CAMPOS = ["nombreCompleto", "correo", "clave", "confirmacion"] as const;

export function FormularioRegistro() {
  const router = useRouter();
  const [confirmacionPendiente, setConfirmacionPendiente] = useState(false);

  const formulario = useForm<DatosRegistro>({
    resolver: zodResolver(esquemaRegistro),
    defaultValues: { nombreCompleto: "", correo: "", clave: "", confirmacion: "" },
  });

  async function enviar(datos: DatosRegistro) {
    const resultado = await registrarAction(datos);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      for (const [campo, mensajes] of Object.entries(resultado.camposConError ?? {})) {
        if ((CAMPOS as readonly string[]).includes(campo)) {
          formulario.setError(campo as (typeof CAMPOS)[number], { message: mensajes[0] });
        }
      }
      return;
    }

    if (resultado.data.requiereConfirmacion) {
      setConfirmacionPendiente(true);
      return;
    }

    toast.success("Cuenta creada. ¡Bienvenido!");
    router.replace("/dashboard");
    router.refresh();
  }

  if (confirmacionPendiente) {
    return (
      <Card>
        <CardHeader>
          <CheckCircle2 className="size-8 text-success" aria-hidden />
          <CardTitle>Confirma tu correo</CardTitle>
          <CardDescription>
            Te enviamos un enlace de confirmación a{" "}
            <strong>{formulario.getValues("correo")}</strong>. Ábrelo para activar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <EnlaceBoton href="/login" variant="outline" className="w-full">
            Volver al inicio de sesión
          </EnlaceBoton>
        </CardFooter>
      </Card>
    );
  }

  const errores = formulario.formState.errors;
  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear cuenta</CardTitle>
        <CardDescription>Empieza a controlar tus proyectos en un minuto.</CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombreCompleto">Nombre completo</Label>
            <Input
              id="nombreCompleto"
              autoComplete="name"
              aria-invalid={!!errores.nombreCompleto}
              {...formulario.register("nombreCompleto")}
            />
            {errores.nombreCompleto ? (
              <p className="text-sm text-destructive">{errores.nombreCompleto.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="correo">Correo electrónico</Label>
            <Input
              id="correo"
              type="email"
              autoComplete="email"
              aria-invalid={!!errores.correo}
              {...formulario.register("correo")}
            />
            {errores.correo ? (
              <p className="text-sm text-destructive">{errores.correo.message}</p>
            ) : null}
          </div>

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

        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Crear cuenta
          </Button>
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-foreground underline">
              Inicia sesión
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
