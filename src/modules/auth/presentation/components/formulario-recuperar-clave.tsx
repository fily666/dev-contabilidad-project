"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

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
import { recuperarClaveAction } from "../actions";
import { esquemaRecuperarClave, type DatosRecuperarClave } from "../schemas";

export function FormularioRecuperarClave() {
  const [enviado, setEnviado] = useState(false);

  const formulario = useForm<DatosRecuperarClave>({
    resolver: zodResolver(esquemaRecuperarClave),
    defaultValues: { correo: "" },
  });

  async function enviar(datos: DatosRecuperarClave) {
    const resultado = await recuperarClaveAction(datos);
    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Card>
        <CardHeader>
          <MailCheck className="size-8 text-success" aria-hidden />
          <CardTitle>Revisa tu correo</CardTitle>
          <CardDescription>
            Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.
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

  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar contraseña</CardTitle>
        <CardDescription>Te enviaremos un enlace para restablecerla.</CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent className="space-y-2">
          <Label htmlFor="correo">Correo electrónico</Label>
          <Input
            id="correo"
            type="email"
            autoComplete="email"
            aria-invalid={!!formulario.formState.errors.correo}
            {...formulario.register("correo")}
          />
          {formulario.formState.errors.correo ? (
            <p className="text-sm text-destructive">{formulario.formState.errors.correo.message}</p>
          ) : null}
        </CardContent>

        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Enviar enlace
          </Button>
          <EnlaceBoton href="/login" variant="ghost" className="w-full">
            Cancelar
          </EnlaceBoton>
        </CardFooter>
      </form>
    </Card>
  );
}
