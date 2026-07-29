import { Suspense } from "react";
import type { Metadata } from "next";
import { FormularioInicioSesion } from "@/modules/auth/presentation/components/formulario-inicio-sesion";
import { Skeleton } from "@/shared/ui/skeleton";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function PaginaLogin() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <FormularioInicioSesion />
    </Suspense>
  );
}
