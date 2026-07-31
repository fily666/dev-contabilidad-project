"use client";

import { useMemo, useState } from "react";

import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { CategoriaConRuta } from "../../domain/categoria.repository";

type Props = {
  /** Ya filtradas por el formulario (naturaleza, tipo de proyecto, etc.). */
  categorias: CategoriaConRuta[];
  /** Id de la categoria elegida: la subcategoria si la hay, si no la raiz. */
  valor: string;
  alCambiar: (categoriaId: string) => void;
  /**
   * Nombre de cada tipo de proyecto. Solo hace falta cuando la lista abarca
   * varios tipos: entonces se usa para distinguir las raices homonimas.
   */
  nombrePorTipo?: Record<string, string>;
  /** Base de los `id` del DOM; el segundo campo añade `-subcategoria`. */
  id?: string;
  etiqueta?: string;
  requerido?: boolean;
  deshabilitado?: boolean;
  error?: string;
};

type Raiz = { id: string; nombre: string; tipoProyectoId: string | null; asignable: boolean };

/**
 * Categoria y subcategoria en dos campos encadenados en lugar de una sola lista
 * con rutas del tipo «Operación › Arriendo». Con el catalogo completo la lista
 * unica mezclaba raices y hojas ordenadas por nombre, y encontrar una
 * subcategoria obligaba a leer la ruta de cada opcion.
 *
 * El valor que sale sigue siendo un unico `categoriaId`, porque asi lo guarda el
 * dominio: la subcategoria cuando se elige, y la raiz cuando no.
 *
 * Devuelve dos celdas sueltas para que el formulario que lo usa las coloque en
 * su propia rejilla.
 */
export function SelectorCategoria({
  categorias,
  valor,
  alCambiar,
  nombrePorTipo,
  id = "categoriaId",
  etiqueta = "Categoría",
  requerido = false,
  deshabilitado = false,
  error,
}: Props) {
  const porId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  /**
   * Una raiz entra en la lista si esta disponible ella misma o si lo esta alguno
   * de sus hijos: al filtrar por naturaleza puede quedar la hoja sin su padre, y
   * entonces el nombre de la raiz se toma de `padreNombre` del hijo.
   */
  const raices = useMemo(() => {
    const mapa = new Map<string, Raiz>();
    for (const c of categorias) {
      if (c.esRaiz) {
        mapa.set(c.id, {
          id: c.id,
          nombre: c.nombre,
          tipoProyectoId: c.tipoProyectoId,
          asignable: true,
        });
      } else if (c.padreId && !mapa.has(c.padreId)) {
        mapa.set(c.padreId, {
          id: c.padreId,
          nombre: c.padreNombre ?? "Sin nombre",
          tipoProyectoId: c.tipoProyectoId,
          asignable: false,
        });
      }
    }

    /**
     * Cuando la lista abarca varios tipos de proyecto hay raices homonimas
     * —«Adquisición» es de inmueble y de vehiculo— y en el desplegable se veian
     * dos opciones identicas. Se anade el tipo solo a las que chocan.
     */
    const veces = new Map<string, number>();
    for (const r of mapa.values()) veces.set(r.nombre, (veces.get(r.nombre) ?? 0) + 1);

    return [...mapa.values()].map((r) => {
      const tipo = r.tipoProyectoId ? nombrePorTipo?.[r.tipoProyectoId] : null;
      if (!tipo || (veces.get(r.nombre) ?? 0) < 2) return r;
      return { ...r, nombre: `${r.nombre} · ${tipo}` };
    });
  }, [categorias, nombrePorTipo]);

  const hijosPorRaiz = useMemo(() => {
    const mapa = new Map<string, CategoriaConRuta[]>();
    for (const c of categorias) {
      if (!c.padreId) continue;
      mapa.set(c.padreId, [...(mapa.get(c.padreId) ?? []), c]);
    }
    return mapa;
  }, [categorias]);

  const raizDelValor = valor
    ? (porId.get(valor)?.padreId ?? (porId.has(valor) ? valor : null))
    : null;

  const [raiz, setRaiz] = useState(raizDelValor ?? "");
  const [valorSincronizado, setValorSincronizado] = useState(valor);

  // Cuando el valor lo cambia el formulario —edicion, o el cambio de tipo que
  // limpia la categoria— manda el formulario y la raiz se recalcula.
  if (valor !== valorSincronizado) {
    setValorSincronizado(valor);
    setRaiz(raizDelValor ?? "");
  }
  // La raiz elegida puede desaparecer del catalogo disponible al cambiar el filtro.
  if (raiz && !raices.some((r) => r.id === raiz)) {
    setRaiz("");
  }

  const hijos = hijosPorRaiz.get(raiz) ?? [];
  const raizAsignable = raices.find((r) => r.id === raiz)?.asignable ?? false;
  const sinSubcategorias = raiz !== "" && hijos.length === 0;

  function elegirRaiz(nueva: string) {
    // Si la raiz es asignable vale por si misma y el campo queda completo; si no
    // lo es, la categoria queda vacia hasta que se elija una subcategoria.
    const siguiente = raices.find((r) => r.id === nueva)?.asignable ? nueva : "";
    setRaiz(nueva);
    setValorSincronizado(siguiente);
    alCambiar(siguiente);
  }

  function elegirSubcategoria(nueva: string) {
    setValorSincronizado(nueva);
    alCambiar(nueva);
  }

  const marcador = requerido ? <span className="text-destructive"> *</span> : null;
  // El error se muestra bajo el campo que falta por completar.
  const errorEnSubcategoria = !!error && raiz !== "" && !valor;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={id}>
          {etiqueta}
          {marcador}
        </Label>
        <Select value={raiz} onValueChange={(v) => elegirRaiz(v ?? "")} disabled={deshabilitado}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Selecciona una categoría" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {raices.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && !errorEnSubcategoria ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-subcategoria`}>Subcategoría</Label>
        <Select
          // Sin hijos el valor es la raiz, que no esta entre estas opciones: se
          // deja vacio para que el disparador muestre el texto y no el id.
          value={sinSubcategorias ? "" : valor}
          onValueChange={(v) => elegirSubcategoria(v ?? "")}
          disabled={deshabilitado || raiz === "" || sinSubcategorias}
        >
          <SelectTrigger id={`${id}-subcategoria`} className="w-full">
            <SelectValue
              placeholder={
                raiz === ""
                  ? "Elige primero la categoría"
                  : sinSubcategorias
                    ? "Sin subcategorías"
                    : "Selecciona una subcategoría"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {raizAsignable && hijos.length > 0 ? (
              <SelectItem value={raiz}>Sin subcategoría</SelectItem>
            ) : null}
            {hijos.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorEnSubcategoria ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </>
  );
}
