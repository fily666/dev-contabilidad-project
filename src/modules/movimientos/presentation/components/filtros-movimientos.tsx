"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ESTADOS_MOVIMIENTO, NATURALEZAS, TIPOS_MOVIMIENTO } from "@/shared/domain/enumeraciones";
import {
  ETIQUETA_ESTADO_MOVIMIENTO,
  ETIQUETA_NATURALEZA,
  ETIQUETA_TIPO_MOVIMIENTO,
} from "@/shared/utils/etiquetas";

const TODOS = "__todos__";

type Props = {
  /** Opcional: dentro de un proyecto no hay nada que elegir. */
  proyectos?: Array<{ id: string; nombre: string }>;
  /** RF-23: el catálogo para filtrar por categoría. */
  categorias?: Array<{ id: string; ruta: string }>;
  /** RF-23: los métodos de pago activos. */
  metodosPago?: Array<{ id: string; nombre: string }>;
  ocultarProyecto?: boolean;
};

/**
 * RF-23: filtros combinables. Viajan en la URL para que la vista sea
 * compartible y recargable (RNF-09).
 *
 * Categoría, método de pago y naturaleza faltaban aquí aunque `leerFiltros` los
 * validaba y el repositorio los soportaba: era capacidad escrita y probada que no
 * llegaba al usuario. RF-23 pide explícitamente categoría y método de pago.
 */
export function FiltrosMovimientos({
  proyectos = [],
  categorias = [],
  metodosPago = [],
  ocultarProyecto,
}: Props) {
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

  const activos = [...parametros.keys()].filter(
    (k) => k !== "pagina" && k !== "ordenCampo" && k !== "ordenDireccion",
  ).length;

  return (
    <div className="panel space-y-4 p-5">
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
          <Label htmlFor="filtro-naturaleza" className="text-xs">
            Naturaleza
          </Label>
          <Select
            value={parametros.get("naturalezas") ?? TODOS}
            onValueChange={(v) => aplicar({ naturalezas: v })}
          >
            <SelectTrigger id="filtro-naturaleza" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas</SelectItem>
              {NATURALEZAS.map((n) => (
                <SelectItem key={n} value={n}>
                  {ETIQUETA_NATURALEZA[n]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {categorias.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="filtro-categoria" className="text-xs">
              Categoría
            </Label>
            <Select
              value={parametros.get("categoriaIds") ?? TODOS}
              onValueChange={(v) => aplicar({ categoriaIds: v })}
            >
              <SelectTrigger id="filtro-categoria" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.ruta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {metodosPago.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="filtro-metodo" className="text-xs">
              Método de pago
            </Label>
            <Select
              value={parametros.get("metodoPagoId") ?? TODOS}
              onValueChange={(v) => aplicar({ metodoPagoId: v })}
            >
              <SelectTrigger id="filtro-metodo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {metodosPago.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

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

      {/*
        El contador dice por qué el total no cuadra con el que el usuario
        recuerda. Antes solo aparecía un botón «Limpiar» sin decir cuántos
        filtros había puestos.
      */}
      {activos > 0 ? (
        <div className="flex items-center gap-2">
          <span className="etiqueta-dato">
            {activos} {activos === 1 ? "filtro activo" : "filtros activos"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTexto("");
              router.push("?");
            }}
          >
            <X className="size-4" aria-hidden /> Limpiar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
