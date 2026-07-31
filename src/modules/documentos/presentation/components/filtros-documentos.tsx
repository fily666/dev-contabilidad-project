"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { TIPOS_DOCUMENTO } from "@/shared/domain/enumeraciones";
import { ETIQUETA_TIPO_DOCUMENTO } from "@/shared/utils/etiquetas";

const TODOS = "__todos__";

type Props = { proyectos: Array<{ id: string; nombre: string }> };

/** RF-47: búsqueda por proyecto, tipo, rango de fechas y nombre (RNF-09). */
export function FiltrosDocumentos({ proyectos }: Props) {
  const router = useRouter();
  const parametros = useSearchParams();
  const [texto, setTexto] = useState(parametros.get("texto") ?? "");

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
    <div className="panel space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filtro-doc-proyecto" className="text-xs">
            Proyecto
          </Label>
          <Select
            value={parametros.get("proyectoId") ?? TODOS}
            onValueChange={(v) => aplicar({ proyectoId: v })}
          >
            <SelectTrigger id="filtro-doc-proyecto" className="w-full">
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
          <Label htmlFor="filtro-doc-tipo" className="text-xs">
            Tipo de documento
          </Label>
          <Select
            value={parametros.get("tipos") ?? TODOS}
            onValueChange={(v) => aplicar({ tipos: v })}
          >
            <SelectTrigger id="filtro-doc-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos</SelectItem>
              {TIPOS_DOCUMENTO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {ETIQUETA_TIPO_DOCUMENTO[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtro-doc-desde" className="text-xs">
            Cargados desde
          </Label>
          <Input
            id="filtro-doc-desde"
            type="date"
            defaultValue={parametros.get("desde") ?? ""}
            onChange={(e) => aplicar({ desde: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filtro-doc-hasta" className="text-xs">
            Cargados hasta
          </Label>
          <Input
            id="filtro-doc-hasta"
            type="date"
            defaultValue={parametros.get("hasta") ?? ""}
            onChange={(e) => aplicar({ hasta: e.target.value })}
          />
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ texto });
        }}
      >
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="filtro-doc-texto" className="text-xs">
            Nombre del archivo
          </Label>
          <Input
            id="filtro-doc-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="escritura, factura, soat…"
          />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="size-4" aria-hidden /> Buscar
        </Button>
        {hayFiltros ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTexto("");
              router.push("?");
            }}
          >
            <X className="size-4" aria-hidden /> Limpiar
          </Button>
        ) : null}
      </form>
    </div>
  );
}
