"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { actualizarPerfilAction } from "../actions";
import { esquemaPerfil, type DatosPerfil } from "../schemas";
import type { Perfil } from "../../domain/sesion";

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

const MONEDAS = ["COP", "USD", "EUR", "MXN", "PEN", "CLP", "ARS"];

/** RF-03, RF-101. */
export function FormularioPerfil({ perfil }: { perfil: Perfil }) {
  const router = useRouter();
  const { setTheme } = useTheme();

  const formulario = useForm<DatosPerfil>({
    resolver: zodResolver(esquemaPerfil),
    defaultValues: {
      nombreCompleto: perfil.nombreCompleto,
      moneda: perfil.moneda,
      zonaHoraria: perfil.zonaHoraria,
      tema: perfil.tema,
    },
  });

  async function enviar(datos: DatosPerfil) {
    const resultado = await actualizarPerfilAction(datos);
    if (!resultado.ok) {
      toast.error(resultado.mensaje);
      return;
    }
    // El tema tambien se aplica de inmediato en el cliente.
    setTheme(datos.tema);
    toast.success("Perfil actualizado.");
    router.refresh();
  }

  const errores = formulario.formState.errors;
  const enviando = formulario.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos y preferencias</CardTitle>
        <CardDescription>
          La zona horaria determina la fecha de negocio con la que se calculan vencimientos y
          cierres de mes.
        </CardDescription>
      </CardHeader>

      <form onSubmit={formulario.handleSubmit(enviar)} noValidate>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="correo">Correo electrónico</Label>
            <Input id="correo" value={perfil.correo} disabled readOnly />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombreCompleto">Nombre completo</Label>
            <Input
              id="nombreCompleto"
              aria-invalid={!!errores.nombreCompleto}
              {...formulario.register("nombreCompleto")}
            />
            {errores.nombreCompleto ? (
              <p className="text-sm text-destructive">{errores.nombreCompleto.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="moneda">Moneda</Label>
              <Select
                defaultValue={perfil.moneda}
                onValueChange={(v) =>
                  formulario.setValue("moneda", v ?? "COP", { shouldValidate: true })
                }
              >
                <SelectTrigger id="moneda" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONEDAS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zonaHoraria">Zona horaria</Label>
              <Select
                defaultValue={perfil.zonaHoraria}
                onValueChange={(v) =>
                  formulario.setValue("zonaHoraria", v ?? "America/Bogota", {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="zonaHoraria" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ZONAS.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tema">Tema</Label>
              <Select
                defaultValue={perfil.tema}
                onValueChange={(v) =>
                  formulario.setValue("tema", v as DatosPerfil["tema"], { shouldValidate: true })
                }
              >
                <SelectTrigger id="tema" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Oscuro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>

        <div className="flex justify-end border-t px-6 py-4">
          <Button type="submit" disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Guardar cambios
          </Button>
        </div>
      </form>
    </Card>
  );
}
