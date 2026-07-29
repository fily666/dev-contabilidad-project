"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { iniciarSesionAction } from "../actions";
import { esquemaIniciarSesion, type DatosIniciarSesion } from "../schemas";

export function FormularioInicioSesion() {
  const router = useRouter();
  const parametros = useSearchParams();
  const siguiente = parametros.get("siguiente") ?? "/dashboard";

  const formulario = useForm<DatosIniciarSesion>({
    resolver: zodResolver(esquemaIniciarSesion),
    defaultValues: { correo: "", clave: "" },
  });

  async function enviar(datos: DatosIniciarSesion) {
    const resultado = await iniciarSesionAction(datos);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      for (const [campo, mensajes] of Object.entries(resultado.camposConError ?? {})) {
        if (campo === "correo" || campo === "clave") {
          formulario.setError(campo, { message: mensajes[0] });
        }
      }
      return;
    }

    router.replace(siguiente);
    router.refresh();
  }

  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Iniciar sesión</CardTitle>
        <CardDescription>Ingresa con tu correo electrónico y contraseña.</CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correo">Correo electrónico</Label>
            <Input
              id="correo"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              aria-invalid={!!formulario.formState.errors.correo}
              {...formulario.register("correo")}
            />
            {formulario.formState.errors.correo ? (
              <p className="text-sm text-destructive">
                {formulario.formState.errors.correo.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="clave">Contraseña</Label>
              <Link href="/recuperar-clave" className="text-xs text-muted-foreground underline">
                ¿La olvidaste?
              </Link>
            </div>
            <Input
              id="clave"
              type="password"
              autoComplete="current-password"
              aria-invalid={!!formulario.formState.errors.clave}
              {...formulario.register("clave")}
            />
            {formulario.formState.errors.clave ? (
              <p className="text-sm text-destructive">
                {formulario.formState.errors.clave.message}
              </p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Entrar
          </Button>
          <p className="text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="text-foreground underline">
              Regístrate
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
