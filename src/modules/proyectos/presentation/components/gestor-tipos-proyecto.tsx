"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/utils/cn";
import { TIPOS_ATRIBUTO, type TipoAtributo } from "@/modules/proyectos/domain/tipo-proyecto.entity";
import { INDICADORES_DISPONIBLES } from "./panel-indicadores";
import {
  actualizarTipoProyectoAction,
  cambiarEstadoTipoProyectoAction,
  crearTipoProyectoAction,
  eliminarTipoProyectoAction,
} from "../actions";

export type TipoProyectoVista = {
  id: string;
  codigo: string;
  nombre: string;
  icono: string | null;
  esSistema: boolean;
  activo: boolean;
  atributos: Array<{ clave: string; etiqueta: string; tipo: TipoAtributo; requerido: boolean }>;
  indicadores: string[];
  generaIngresos: boolean;
  seValoriza: boolean;
};

type Props = { tipos: TipoProyectoVista[] };

const ETIQUETA_TIPO_ATRIBUTO: Record<TipoAtributo, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  boolean: "Sí / No",
};

const VACIO: TipoProyectoVista = {
  id: "",
  codigo: "",
  nombre: "",
  icono: null,
  esSistema: false,
  activo: true,
  atributos: [],
  indicadores: ["total_invertido", "total_egresos"],
  generaIngresos: true,
  seValoriza: false,
};

/**
 * RF-100 y §13: crear tipos de proyecto propios con sus atributos e indicadores.
 *
 * Los indicadores se eligen de un catálogo cerrado, el mismo que sabe dibujarlos
 * (`INDICADORES_DISPONIBLES`). Es la respuesta al punto 3 del checklist de §13:
 * una clave que no exista en el registro no rompe nada, simplemente no se dibuja,
 * y ese silencio es peor que un error, así que aquí no se puede escribir a mano.
 */
export function GestorTiposProyecto({ tipos }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [editando, setEditando] = useState<TipoProyectoVista | null>(null);
  const [borrando, setBorrando] = useState<TipoProyectoVista | null>(null);
  const [borrador, setBorrador] = useState<TipoProyectoVista>(VACIO);

  function abrir(tipo: TipoProyectoVista | null) {
    setBorrador(tipo ? { ...tipo, atributos: tipo.atributos.map((a) => ({ ...a })) } : VACIO);
    setEditando(tipo ?? VACIO);
  }

  function guardar() {
    const carga = {
      nombre: borrador.nombre,
      icono: borrador.icono,
      atributos: borrador.atributos,
      indicadores: borrador.indicadores,
      generaIngresos: borrador.generaIngresos,
      seValoriza: borrador.seValoriza,
    };

    iniciarTransicion(async () => {
      const resultado = borrador.id
        ? await actualizarTipoProyectoAction({ ...carga, id: borrador.id })
        : await crearTipoProyectoAction({ ...carga, codigo: borrador.codigo });

      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setEditando(null);
      toast.success(borrador.id ? "Tipo actualizado." : "Tipo creado.");
      router.refresh();
    });
  }

  function cambiarEstado(tipo: TipoProyectoVista) {
    iniciarTransicion(async () => {
      const resultado = await cambiarEstadoTipoProyectoAction({
        id: tipo.id,
        activo: !tipo.activo,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success(tipo.activo ? "Tipo oculto." : "Tipo reactivado.");
      router.refresh();
    });
  }

  function eliminar(tipo: TipoProyectoVista) {
    iniciarTransicion(async () => {
      const resultado = await eliminarTipoProyectoAction({ id: tipo.id });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setBorrando(null);
      toast.success("Tipo eliminado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Los tipos definen los atributos y los indicadores de cada proyecto. Agregar uno no
          requiere migración de base de datos.
        </p>
        <Button onClick={() => abrir(null)}>
          <Plus className="size-4" aria-hidden /> Nuevo tipo
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {tipos.map((tipo) => (
          <li key={tipo.id} className={cn("panel space-y-3 p-4", !tipo.activo && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{tipo.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">{tipo.codigo}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {tipo.esSistema ? <Badge variant="outline">Sistema</Badge> : null}
                {!tipo.activo ? <Badge variant="outline">Oculto</Badge> : null}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {tipo.atributos.length} atributo(s) · {tipo.indicadores.length} indicador(es) ·{" "}
              {tipo.generaIngresos ? "genera ingresos" : "sin ingresos"}
              {tipo.seValoriza ? " · se valoriza" : ""}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => abrir(tipo)}
                disabled={tipo.esSistema}
                title={
                  tipo.esSistema
                    ? "Los tipos del sistema no se editan; puedes ocultarlos."
                    : undefined
                }
              >
                Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cambiarEstado(tipo)}
                disabled={pendiente}
              >
                {tipo.activo ? (
                  <>
                    <EyeOff className="size-4" aria-hidden /> Ocultar
                  </>
                ) : (
                  <>
                    <Eye className="size-4" aria-hidden /> Reactivar
                  </>
                )}
              </Button>
              {!tipo.esSistema ? (
                <Button variant="ghost" size="sm" onClick={() => setBorrando(tipo)}>
                  <Trash2 className="size-4" aria-hidden /> Eliminar
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={editando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setEditando(null);
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{borrador.id ? "Editar tipo" : "Nuevo tipo de proyecto"}</DialogTitle>
            <DialogDescription>
              Las etiquetas de los atributos son texto de interfaz y van con tildes; las claves son
              identificadores y van sin acentos ni espacios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo-nombre">Nombre</Label>
                <Input
                  id="tipo-nombre"
                  value={borrador.nombre}
                  onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                  placeholder="Construcción de vivienda"
                />
              </div>

              {!borrador.id ? (
                <div className="space-y-2">
                  <Label htmlFor="tipo-codigo">Código</Label>
                  <Input
                    id="tipo-codigo"
                    value={borrador.codigo}
                    onChange={(e) => setBorrador({ ...borrador, codigo: e.target.value })}
                    placeholder="construccion"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Código</Label>
                  <p className="text-sm text-muted-foreground">
                    {borrador.codigo} · no se cambia una vez creado
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Atributos propios</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setBorrador({
                      ...borrador,
                      atributos: [
                        ...borrador.atributos,
                        { clave: "", etiqueta: "", tipo: "text", requerido: false },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" aria-hidden /> Agregar
                </Button>
              </div>

              {borrador.atributos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sin atributos propios: el proyecto tendrá solo los campos comunes.
                </p>
              ) : null}

              {borrador.atributos.map((atributo, indice) => (
                <div key={indice} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`clave-${indice}`} className="text-xs">
                      Clave
                    </Label>
                    <Input
                      id={`clave-${indice}`}
                      value={atributo.clave}
                      onChange={(e) => {
                        const atributos = [...borrador.atributos];
                        atributos[indice] = { ...atributo, clave: e.target.value };
                        setBorrador({ ...borrador, atributos });
                      }}
                      placeholder="area_construida"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`etiqueta-${indice}`} className="text-xs">
                      Etiqueta
                    </Label>
                    <Input
                      id={`etiqueta-${indice}`}
                      value={atributo.etiqueta}
                      onChange={(e) => {
                        const atributos = [...borrador.atributos];
                        atributos[indice] = { ...atributo, etiqueta: e.target.value };
                        setBorrador({ ...borrador, atributos });
                      }}
                      placeholder="Área construida (m²)"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={atributo.tipo}
                      onValueChange={(v) => {
                        const atributos = [...borrador.atributos];
                        atributos[indice] = { ...atributo, tipo: (v ?? "text") as TipoAtributo };
                        setBorrador({ ...borrador, atributos });
                      }}
                    >
                      <SelectTrigger className="min-w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_ATRIBUTO.map((t) => (
                          <SelectItem key={t} value={t}>
                            {ETIQUETA_TIPO_ATRIBUTO[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 pb-2">
                    <Checkbox
                      id={`requerido-${indice}`}
                      checked={atributo.requerido}
                      onCheckedChange={(marcado) => {
                        const atributos = [...borrador.atributos];
                        atributos[indice] = { ...atributo, requerido: marcado === true };
                        setBorrador({ ...borrador, atributos });
                      }}
                    />
                    <Label htmlFor={`requerido-${indice}`} className="text-xs">
                      Obligatorio
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar atributo"
                      onClick={() =>
                        setBorrador({
                          ...borrador,
                          atributos: borrador.atributos.filter((_, i) => i !== indice),
                        })
                      }
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Indicadores visibles</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {INDICADORES_DISPONIBLES.map((indicador) => (
                  <label key={indicador.clave} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={borrador.indicadores.includes(indicador.clave)}
                      onCheckedChange={(marcado) =>
                        setBorrador({
                          ...borrador,
                          indicadores:
                            marcado === true
                              ? [...borrador.indicadores, indicador.clave]
                              : borrador.indicadores.filter((i) => i !== indicador.clave),
                        })
                      }
                    />
                    {indicador.etiqueta}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="genera-ingresos" className="cursor-pointer text-sm">
                  Genera ingresos
                </Label>
                <Switch
                  id="genera-ingresos"
                  checked={borrador.generaIngresos}
                  onCheckedChange={(v) => setBorrador({ ...borrador, generaIngresos: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label htmlFor="se-valoriza" className="cursor-pointer text-sm">
                  Se valoriza
                </Label>
                <Switch
                  id="se-valoriza"
                  checked={borrador.seValoriza}
                  onCheckedChange={(v) => setBorrador({ ...borrador, seValoriza: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={pendiente || borrador.nombre.trim() === ""}>
              {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={borrando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setBorrando(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar «{borrando?.nombre}»?</DialogTitle>
            <DialogDescription>
              Solo se puede eliminar si ningún proyecto lo usa. Si lo usa alguno, ocúltalo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBorrando(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => borrando && eliminar(borrando)}
              disabled={pendiente}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
