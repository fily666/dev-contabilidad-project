"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

const TODOS = "__todos__";

type Props = {
  proyectos: Array<{ id: string; nombre: string }>;
  /** Rango vigente, ya resuelto por el servidor. */
  desde: string;
  hasta: string;
};

/** Atajos de rango: lo que se consulta el 95 % de las veces. */
const ATAJOS = [
  { etiqueta: "12 meses", meses: 12 },
  { etiqueta: "6 meses", meses: 6 },
  { etiqueta: "3 meses", meses: 3 },
] as const;

function restarMeses(hasta: string, meses: number): string {
  const [anio, mes, dia] = hasta.split("-").map(Number) as [number, number, number];
  const fecha = new Date(Date.UTC(anio, mes - 1 - meses, dia));
  return fecha.toISOString().slice(0, 10);
}

/** RF-79: un solo filtro para todas las cifras del panel. */
export function FiltrosPanel({ proyectos, desde, hasta }: Props) {
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

  const hayFiltros = [...parametros.keys()].length > 0;

  return (
    <div className="panel flex flex-wrap items-end gap-3 p-5">
      <div className="min-w-44 space-y-1.5">
        <Label htmlFor="panel-proyecto" className="text-xs">
          Proyecto
        </Label>
        <Select
          value={parametros.get("proyectoId") ?? TODOS}
          onValueChange={(v) => aplicar({ proyectoId: v })}
        >
          <SelectTrigger id="panel-proyecto" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            {proyectos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="panel-desde" className="text-xs">
          Desde
        </Label>
        <Input
          id="panel-desde"
          type="date"
          value={desde}
          onChange={(e) => aplicar({ desde: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="panel-hasta" className="text-xs">
          Hasta
        </Label>
        <Input
          id="panel-hasta"
          type="date"
          value={hasta}
          onChange={(e) => aplicar({ hasta: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="size-4 text-muted-foreground" aria-hidden />
        {ATAJOS.map((atajo) => (
          <Button
            key={atajo.etiqueta}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => aplicar({ desde: restarMeses(hasta, atajo.meses), hasta })}
          >
            {atajo.etiqueta}
          </Button>
        ))}
        {hayFiltros ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push("?")}>
            <X className="size-4" aria-hidden /> Limpiar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
