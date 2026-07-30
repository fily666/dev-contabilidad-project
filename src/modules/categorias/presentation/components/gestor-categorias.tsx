"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { InsigniaNaturaleza } from "@/shared/ui/insignias";
import { NATURALEZAS, type Naturaleza } from "@/shared/domain/enumeraciones";
import { DESCRIPCION_NATURALEZA, ETIQUETA_NATURALEZA } from "@/shared/utils/etiquetas";
import type { CategoriaConRuta } from "../../domain/categoria.repository";
import {
  cambiarEstadoCategoriaAction,
  crearCategoriaAction,
  eliminarCategoriaAction,
} from "../actions";

type Props = {
  categorias: CategoriaConRuta[];
  tipos: Array<{ id: string; nombre: string }>;
};

const SIN_TIPO = "__transversal__";
const SIN_PADRE = "__raiz__";

/** RF-30, RF-31, RF-32, RF-34. */
export function GestorCategorias({ categorias, tipos }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();

  const [nombre, setNombre] = useState("");
  const [naturaleza, setNaturaleza] = useState<Naturaleza>("opex");
  const [tipoProyectoId, setTipoProyectoId] = useState(SIN_TIPO);
  const [padreId, setPadreId] = useState(SIN_PADRE);

  const raices = useMemo(() => categorias.filter((c) => c.esRaiz), [categorias]);

  const agrupadas = useMemo(() => {
    const porPadre = new Map<string, CategoriaConRuta[]>();
    for (const categoria of categorias) {
      if (categoria.esRaiz) continue;
      const lista = porPadre.get(categoria.padreId!) ?? [];
      lista.push(categoria);
      porPadre.set(categoria.padreId!, lista);
    }
    return raices.map((raiz) => ({ raiz, hijas: porPadre.get(raiz.id) ?? [] }));
  }, [categorias, raices]);

  function crear() {
    iniciarTransicion(async () => {
      const resultado = await crearCategoriaAction({
        nombre,
        naturaleza,
        tipoProyectoId: tipoProyectoId === SIN_TIPO ? null : tipoProyectoId,
        padreId: padreId === SIN_PADRE ? null : padreId,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setNombre("");
      toast.success("Categoría creada.");
      router.refresh();
    });
  }

  function alternarVisibilidad(id: string, activa: boolean) {
    iniciarTransicion(async () => {
      const resultado = await cambiarEstadoCategoriaAction({ id, activa: !activa });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      router.refresh();
    });
  }

  function eliminar(id: string) {
    iniciarTransicion(async () => {
      const resultado = await eliminarCategoriaAction({ id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Categoría eliminada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 p-5">
        <div>
          <h3 className="font-medium">Crear categoría</h3>
          <p className="text-sm text-muted-foreground">
            La naturaleza define si el movimiento capitaliza, es gasto operativo, financiación o
            ingreso.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-nombre" className="text-xs">
              Nombre
            </Label>
            <Input
              id="cat-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cuota extraordinaria"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-padre" className="text-xs">
              Categoría padre
            </Label>
            <Select value={padreId} onValueChange={(v) => setPadreId(v ?? SIN_PADRE)}>
              <SelectTrigger id="cat-padre" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={SIN_PADRE}>Sin padre (categoría raíz)</SelectItem>
                {raices.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-naturaleza" className="text-xs">
              Naturaleza
            </Label>
            <Select
              value={naturaleza}
              onValueChange={(v) => setNaturaleza(v as Naturaleza)}
              disabled={padreId !== SIN_PADRE}
            >
              <SelectTrigger id="cat-naturaleza" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATURALEZAS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {ETIQUETA_NATURALEZA[n]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {padreId === SIN_PADRE
                ? DESCRIPCION_NATURALEZA[naturaleza]
                : "Se hereda de la categoría padre."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-tipo" className="text-xs">
              Tipo de proyecto
            </Label>
            <Select
              value={tipoProyectoId}
              onValueChange={(v) => setTipoProyectoId(v ?? SIN_TIPO)}
              disabled={padreId !== SIN_PADRE}
            >
              <SelectTrigger id="cat-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_TIPO}>Todos los tipos</SelectItem>
                {tipos.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={crear} disabled={pendiente || nombre.trim().length === 0}>
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          Crear categoría
        </Button>
      </div>

      <div className="space-y-4">
        {agrupadas.map(({ raiz, hijas }) => (
          <div key={raiz.id} className="panel">
            <div className="flex items-center justify-between gap-3 border-b p-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-medium">{raiz.nombre}</span>
                <InsigniaNaturaleza naturaleza={raiz.naturaleza} />
                {raiz.esSistema ? (
                  <Badge variant="secondary" className="text-xs">
                    Sistema
                  </Badge>
                ) : null}
              </div>
              <FilaAcciones
                categoria={raiz}
                pendiente={pendiente}
                alAlternar={alternarVisibilidad}
                alEliminar={eliminar}
              />
            </div>

            {hijas.length > 0 ? (
              <ul className="divide-y">
                {hijas.map((hija) => (
                  <li key={hija.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-muted-foreground" aria-hidden>
                        ↳
                      </span>
                      <span className="truncate text-sm">{hija.nombre}</span>
                      {hija.esSistema ? null : (
                        <Badge variant="outline" className="text-xs">
                          Propia
                        </Badge>
                      )}
                    </div>
                    <FilaAcciones
                      categoria={hija}
                      pendiente={pendiente}
                      alAlternar={alternarVisibilidad}
                      alEliminar={eliminar}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilaAcciones({
  categoria,
  pendiente,
  alAlternar,
  alEliminar,
}: {
  categoria: CategoriaConRuta;
  pendiente: boolean;
  alAlternar: (id: string, activa: boolean) => void;
  alEliminar: (id: string) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={pendiente}
        onClick={() => alAlternar(categoria.id, categoria.activa)}
        aria-label={categoria.activa ? "Ocultar categoría" : "Mostrar categoría"}
        title={categoria.activa ? "Ocultar" : "Mostrar"}
      >
        {categoria.activa ? (
          <Eye className="size-4" aria-hidden />
        ) : (
          <EyeOff className="size-4 opacity-50" aria-hidden />
        )}
      </Button>
      {!categoria.esSistema ? (
        <Button
          variant="ghost"
          size="icon"
          disabled={pendiente}
          onClick={() => alEliminar(categoria.id)}
          aria-label="Eliminar categoría"
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
