"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FileSpreadsheet, FileText, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { ESTADOS_MOVIMIENTO, TIPOS_MOVIMIENTO } from "@/shared/domain/enumeraciones";
import { ETIQUETA_ESTADO_MOVIMIENTO, ETIQUETA_TIPO_MOVIMIENTO } from "@/shared/utils/etiquetas";
import { TIPOS_REPORTE, type TipoReporte } from "../../domain/reporte";

const TODOS = "__todos__";

const ETIQUETA_REPORTE: Record<TipoReporte, string> = {
  movimientos: "Movimientos (RF-90)",
  estado: "Estado financiero por proyecto (RF-91)",
  flujo: "Flujo de caja mensual (RF-92)",
  obligaciones: "Obligaciones (RF-93)",
};

type Props = {
  proyectos: Array<{ id: string; nombre: string }>;
  /** Cadena de consulta ya resuelta para los enlaces de exportación. */
  consulta: string;
  /** Los filtros de movimiento no aplican a todos los reportes. */
  tipo: TipoReporte;
};

/** RF-90 a RF-95: elección del reporte, filtros y exportación. */
export function SelectorReporte({ proyectos, consulta, tipo }: Props) {
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

  const aplicaMovimientos = tipo === "movimientos";

  return (
    <div className="panel space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="reporte-tipo" className="text-xs">
            Reporte
          </Label>
          <Select value={tipo} onValueChange={(v) => aplicar({ reporte: v })}>
            <SelectTrigger id="reporte-tipo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_REPORTE.map((t) => (
                <SelectItem key={t} value={t}>
                  {ETIQUETA_REPORTE[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reporte-proyecto" className="text-xs">
            Proyecto
          </Label>
          <Select
            value={parametros.get("proyectoId") ?? TODOS}
            onValueChange={(v) => aplicar({ proyectoId: v })}
          >
            <SelectTrigger id="reporte-proyecto" className="w-full">
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
          <Label htmlFor="reporte-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="reporte-desde"
            type="date"
            defaultValue={parametros.get("desde") ?? ""}
            onChange={(e) => aplicar({ desde: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reporte-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="reporte-hasta"
            type="date"
            defaultValue={parametros.get("hasta") ?? ""}
            onChange={(e) => aplicar({ hasta: e.target.value })}
          />
        </div>

        {aplicaMovimientos ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="reporte-tipos" className="text-xs">
                Tipo de movimiento
              </Label>
              <Select
                value={parametros.get("tipos") ?? TODOS}
                onValueChange={(v) => aplicar({ tipos: v })}
              >
                <SelectTrigger id="reporte-tipos" className="w-full">
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
              <Label htmlFor="reporte-estados" className="text-xs">
                Estado
              </Label>
              <Select
                value={parametros.get("estados") ?? TODOS}
                onValueChange={(v) => aplicar({ estados: v })}
              >
                <SelectTrigger id="reporte-estados" className="w-full">
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
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          La exportación conserva exactamente estos filtros. Máximo 10.000 filas por archivo.
        </p>
        <div className="flex flex-wrap gap-2">
          {[...parametros.keys()].length > 0 ? (
            <Button type="button" variant="ghost" onClick={() => router.push("?")}>
              <X className="size-4" aria-hidden /> Limpiar
            </Button>
          ) : null}
          {/* Descargas: enlaces, no acciones. El navegador debe poder abrirlas
              en pestaña nueva y reintentarlas. */}
          <EnlaceBoton href={`/api/exportar/excel?${consulta}`} variant="secondary">
            <FileSpreadsheet className="size-4" aria-hidden /> Excel
          </EnlaceBoton>
          <EnlaceBoton href={`/api/exportar/pdf?${consulta}`} variant="secondary">
            <FileText className="size-4" aria-hidden /> PDF
          </EnlaceBoton>
        </div>
      </div>
    </div>
  );
}
