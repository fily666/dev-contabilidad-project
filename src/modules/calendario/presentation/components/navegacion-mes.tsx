"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { TIPOS_MOVIMIENTO } from "@/shared/domain/enumeraciones";
import { ETIQUETA_TIPO_MOVIMIENTO } from "@/shared/utils/etiquetas";
import { formatearMes } from "@/shared/utils/formato";
import { mesAnterior, mesSiguiente } from "../../domain/mes";

const TODOS = "__todos__";

type Props = {
  mes: string;
  mesActual: string;
  proyectos: Array<{ id: string; nombre: string }>;
};

/** RF-60, RF-62: navegación por mes y filtros de proyecto y tipo. */
export function NavegacionMes({ mes, mesActual, proyectos }: Props) {
  const router = useRouter();
  const parametros = useSearchParams();

  function aplicar(cambios: Record<string, string | null>) {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "" || valor === TODOS) nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    router.push(`?${nuevos.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mes anterior"
          onClick={() => aplicar({ mes: mesAnterior(mes) })}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <p className="min-w-40 text-center text-lg font-medium capitalize">
          {formatearMes(`${mes}-01`)}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mes siguiente"
          onClick={() => aplicar({ mes: mesSiguiente(mes) })}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
        {mes !== mesActual ? (
          <Button variant="secondary" size="sm" onClick={() => aplicar({ mes: null })}>
            Hoy
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={parametros.get("proyectoId") ?? TODOS}
          onValueChange={(v) => aplicar({ proyectoId: v })}
        >
          <SelectTrigger aria-label="Proyecto" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los proyectos</SelectItem>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={parametros.get("tipo") ?? TODOS} onValueChange={(v) => aplicar({ tipo: v })}>
          <SelectTrigger aria-label="Tipo de movimiento" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Ingresos y egresos</SelectItem>
            {TIPOS_MOVIMIENTO.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>
                {ETIQUETA_TIPO_MOVIMIENTO[tipo]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
