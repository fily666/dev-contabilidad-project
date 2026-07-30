import { Suspense } from "react";
import type { Metadata } from "next";

import { FormularioAcceso } from "@/modules/acceso/presentation/components/formulario-acceso";
import { Skeleton } from "@/shared/ui/skeleton";

export const metadata: Metadata = { title: "Ingresar" };

export default function PaginaAcceso() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <FormularioAcceso />
    </Suspense>
  );
}
