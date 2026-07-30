"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

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

import { ingresarAction } from "../actions";
import { esquemaAcceso, type DatosAcceso } from "../schemas";

export function FormularioAcceso() {
  const router = useRouter();
  const parametros = useSearchParams();
  const siguiente = parametros.get("siguiente") ?? "/dashboard";

  const formulario = useForm<DatosAcceso>({
    resolver: zodResolver(esquemaAcceso),
    defaultValues: { token: "" },
  });

  async function enviar(datos: DatosAcceso) {
    const resultado = await ingresarAction(datos);

    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      const errores = resultado.camposConError?.token;
      formulario.setError("token", { message: errores?.[0] ?? resultado.mensaje });
      formulario.resetField("token");
      return;
    }

    router.replace(siguiente);
    router.refresh();
  }

  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresar</CardTitle>
        <CardDescription>
          Este gestor es de uso personal. Escribe el token de acceso para continuar.
        </CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="token">Token de acceso</Label>
            <Input
              id="token"
              type="password"
              autoComplete="current-password"
              autoFocus
              aria-invalid={!!formulario.formState.errors.token}
              {...formulario.register("token")}
            />
            {formulario.formState.errors.token ? (
              <p className="text-sm text-destructive">
                {formulario.formState.errors.token.message}
              </p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="mt-6">
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <KeyRound className="size-4" aria-hidden />
            )}
            Entrar
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
