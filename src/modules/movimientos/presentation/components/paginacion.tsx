"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";

type Props = { pagina: number; porPagina: number; total: number };

/** RF-24. */
export function Paginacion({ pagina, porPagina, total }: Props) {
  const router = useRouter();
  const parametros = useSearchParams();

  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);

  function ir(destino: number) {
    const nuevos = new URLSearchParams(parametros.toString());
    nuevos.set("pagina", String(destino));
    router.push(`?${nuevos.toString()}`);
  }

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <p className="tabular-nums">
        {desde}–{hasta} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => ir(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="tabular-nums">
          {pagina} / {paginas}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => ir(pagina + 1)}
          disabled={pagina >= paginas}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
