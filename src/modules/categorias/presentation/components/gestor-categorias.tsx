"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

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
  actualizarCategoriaAction,
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

  /**
   * RF-31: renombrar.
   *
   * `ActualizarCategoria` y `actualizarCategoriaAction` estaban escritas, probadas
   * y sin un solo consumidor: el gestor solo creaba, ocultaba y eliminaba, así que
   * una categoría mal escrita quedaba mal escrita para siempre en todos los
   * movimientos que la usaran. Se edita en línea y no en un diálogo porque el único
   * campo editable es el nombre; abrir un modal para un campo es ceremonia.
   */
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");

  function empezarEdicion(categoria: CategoriaConRuta) {
    setEditando(categoria.id);
    setNombreEditado(categoria.nombre);
  }

  function guardarNombre(id: string) {
    iniciarTransicion(async () => {
      const resultado = await actualizarCategoriaAction({ id, nombre: nombreEditado });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setEditando(null);
      toast.success("Categoría renombrada.");
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
                {editando === raiz.id ? (
                  <CampoNombre
                    valor={nombreEditado}
                    alCambiar={setNombreEditado}
                    alGuardar={() => guardarNombre(raiz.id)}
                    alCancelar={() => setEditando(null)}
                    pendiente={pendiente}
                  />
                ) : (
                  <span className="truncate font-medium">{raiz.nombre}</span>
                )}
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
                alEditar={editando === raiz.id ? undefined : empezarEdicion}
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
                      {editando === hija.id ? (
                        <CampoNombre
                          valor={nombreEditado}
                          alCambiar={setNombreEditado}
                          alGuardar={() => guardarNombre(hija.id)}
                          alCancelar={() => setEditando(null)}
                          pendiente={pendiente}
                        />
                      ) : (
                        <span className="truncate text-sm">{hija.nombre}</span>
                      )}
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
                      alEditar={editando === hija.id ? undefined : empezarEdicion}
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
  alEditar,
}: {
  categoria: CategoriaConRuta;
  pendiente: boolean;
  alAlternar: (id: string, activa: boolean) => void;
  alEliminar: (id: string) => void;
  alEditar?: (categoria: CategoriaConRuta) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {/*
        Las filas del sistema no se renombran: lo impide el trigger
        `proteger_filas_de_sistema()` (§6.6), y ofrecer el botón sería prometer
        algo que la base rechaza.
      */}
      {alEditar && !categoria.esSistema ? (
        <Button
          variant="ghost"
          size="icon"
          disabled={pendiente}
          onClick={() => alEditar(categoria)}
          aria-label="Renombrar categoría"
          title="Renombrar"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      ) : null}
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

/** Edición en línea del nombre: Enter guarda, Escape cancela. */
function CampoNombre({
  valor,
  alCambiar,
  alGuardar,
  alCancelar,
  pendiente,
}: {
  valor: string;
  alCambiar: (v: string) => void;
  alGuardar: () => void;
  alCancelar: () => void;
  pendiente: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Input
        autoFocus
        value={valor}
        aria-label="Nombre de la categoría"
        onChange={(e) => alCambiar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") alGuardar();
          if (e.key === "Escape") alCancelar();
        }}
        className="h-8 w-48"
      />
      <Button
        variant="ghost"
        size="icon"
        disabled={pendiente || valor.trim() === ""}
        onClick={alGuardar}
        aria-label="Guardar nombre"
      >
        {pendiente ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
      </Button>
      <Button variant="ghost" size="icon" onClick={alCancelar} aria-label="Cancelar">
        <X className="size-4" aria-hidden />
      </Button>
    </span>
  );
}
