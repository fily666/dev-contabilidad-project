"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ESTADOS_MOVIMIENTO, TIPOS_MOVIMIENTO } from "@/shared/domain/enumeraciones";
import { ETIQUETA_ESTADO_MOVIMIENTO, ETIQUETA_TIPO_MOVIMIENTO } from "@/shared/utils/etiquetas";

const TODOS = "__todos__";

type Props = {
  proyectos: Array<{ id: string; nombre: string }>;
  ocultarProyecto?: boolean;
};

/**
 * RF-23: filtros combinables. Viajan en la URL para que la vista sea
 * compartible y recargable (RNF-09).
 */
export function FiltrosMovimientos({ proyectos, ocultarProyecto }: Props) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [texto, setTexto] = useState(parametros.get("texto") ?? "");

  function aplicar(cambios: Record<string, string | null>) {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "" || valor === TODOS) nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    nuevos.delete("pagina");
    router.push(`?${nuevos.toString()}`);
  }

  const hayFiltros = [...parametros.keys()].some((k) => k !== "pagina");

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!ocultarProyecto ? (
          <div className="space-y-1.5">
            <Label htmlFor="filtro-proyecto" className="text-xs">
              Proyecto
            </Label>
            <Select
              value={parametros.get("proyectoId") ?? TODOS}
              onValueChange={(v) => aplicar({ proyectoId: v })}
            >
              <SelectTrigger id="filtro-proyecto" className="w-full">
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
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="filtro-tipo" className="text-xs">
            Tipo
          </Label>
          <Select
            value={parametros.get("tipos") ?? TODOS}
            onValueChange={(v) => aplicar({ tipos: v })}
          >
            <SelectTrigger id="filtro-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {TIPOS_MOVIMIENTO.map((t) => (
                <SelectItem key={t} value={t}>
                  {ETIQUETA_TIPO_MOVIMIENTO[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtro-estado" className="text-xs">
            Estado
          </Label>
          <Select
            value={parametros.get("estados") ?? TODOS}
            onValueChange={(v) => aplicar({ estados: v })}
          >
            <SelectTrigger id="filtro-estado" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {ESTADOS_MOVIMIENTO.map((e) => (
                <SelectItem key={e} value={e}>
                  {ETIQUETA_ESTADO_MOVIMIENTO[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtro-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="filtro-desde"
            type="date"
            defaultValue={parametros.get("desde") ?? ""}
            onChange={(e) => aplicar({ desde: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtro-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="filtro-hasta"
            type="date"
            defaultValue={parametros.get("hasta") ?? ""}
            onChange={(e) => aplicar({ hasta: e.target.value })}
          />
        </div>

        <form
          className="space-y-1.5 sm:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            aplicar({ texto });
          }}
        >
          <Label htmlFor="filtro-texto" className="text-xs">
            Buscar en la descripción
          </Label>
          <div className="flex gap-2">
            <Input
              id="filtro-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="administración, SOAT, canon…"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
              <Search className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
      </div>

      {hayFiltros ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTexto("");
            router.push("?");
          }}
        >
          <X className="size-4" aria-hidden /> Limpiar filtros
        </Button>
      ) : null}
    </div>
  );
}
