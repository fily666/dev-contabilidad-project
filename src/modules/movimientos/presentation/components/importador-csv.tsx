"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/utils/cn";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { COLUMNAS_ESPERADAS, PLANTILLA_CSV } from "../../domain/importacion";
import type { Previsualizacion } from "../../application/importar-movimientos.use-case";
import { importarMovimientosAction, previsualizarImportacionAction } from "../actions";

const SIN_PROYECTO = "__ninguno__";

type Props = {
  proyectos: Array<{ id: string; nombre: string }>;
  moneda: string;
};

/** RF-27: previsualización fila por fila antes de escribir nada. */
export function ImportadorCsv({ proyectos, moneda }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [contenido, setContenido] = useState("");
  const [proyectoId, setProyectoId] = useState(SIN_PROYECTO);
  const [previsualizacion, setPrevisualizacion] = useState<Previsualizacion | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  function cargarArchivo(archivo: File) {
    const lector = new FileReader();
    lector.onload = () => {
      setContenido(String(lector.result ?? ""));
      setPrevisualizacion(null);
    };
    lector.readAsText(archivo, "utf-8");
  }

  function previsualizar() {
    iniciarTransicion(async () => {
      const resultado = await previsualizarImportacionAction({
        contenido,
        proyectoId: proyectoId === SIN_PROYECTO ? "" : proyectoId,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      setPrevisualizacion(resultado.data);
      if (resultado.data.resumen.conErrores > 0) {
        toast.warning(`${resultado.data.resumen.conErrores} fila(s) con errores.`);
      }
    });
  }

  function importar() {
    iniciarTransicion(async () => {
      const resultado = await importarMovimientosAction({
        contenido,
        proyectoId: proyectoId === SIN_PROYECTO ? "" : proyectoId,
      });
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }

      const { importados, omitidos, fallidos } = resultado.data;
      toast.success(
        `${importados} movimiento(s) importado(s)` +
          (omitidos > 0 ? `, ${omitidos} omitido(s) por errores` : "") +
          (fallidos.length > 0 ? `, ${fallidos.length} fallaron al guardar` : "") +
          ".",
      );
      setContenido("");
      setPrevisualizacion(null);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    });
  }

  function descargarPlantilla() {
    const url = URL.createObjectURL(new Blob([PLANTILLA_CSV], { type: "text/csv;charset=utf-8" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "plantilla_movimientos.csv";
    enlace.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="panel space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="csv-proyecto">Proyecto por omisión</Label>
            <Select value={proyectoId} onValueChange={(v) => setProyectoId(v ?? SIN_PROYECTO)}>
              <SelectTrigger id="csv-proyecto" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_PROYECTO}>Usar la columna «proyecto»</SelectItem>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se aplica a las filas que no traen proyecto.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="csv-archivo">Archivo CSV</Label>
            <Input
              ref={entrada}
              id="csv-archivo"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) cargarArchivo(archivo);
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={descargarPlantilla}>
              <Download className="size-4" aria-hidden /> Descargar plantilla
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="csv-contenido">Contenido</Label>
          <Textarea
            id="csv-contenido"
            rows={6}
            value={contenido}
            onChange={(e) => {
              setContenido(e.target.value);
              setPrevisualizacion(null);
            }}
            placeholder={COLUMNAS_ESPERADAS.join(",")}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Columnas: {COLUMNAS_ESPERADAS.join(", ")}. Obligatorias: fecha, tipo, categoría, valor y
            descripción. Separador coma o punto y coma.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={previsualizar}
            disabled={pendiente || contenido.trim() === ""}
          >
            {pendiente ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Previsualizar
          </Button>
          <Button
            onClick={importar}
            disabled={pendiente || (previsualizacion?.resumen.importables ?? 0) === 0}
          >
            <Upload className="size-4" aria-hidden /> Importar{" "}
            {previsualizacion ? `${previsualizacion.resumen.importables} fila(s)` : ""}
          </Button>
        </div>
      </div>

      {previsualizacion ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <TarjetaIndicador
              etiqueta="Filas leídas"
              valor={String(previsualizacion.resumen.total)}
            />
            <TarjetaIndicador
              etiqueta="Importables"
              valor={String(previsualizacion.resumen.importables)}
              tono="positivo"
              icono={<CheckCircle2 className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Con errores"
              valor={String(previsualizacion.resumen.conErrores)}
              tono={previsualizacion.resumen.conErrores > 0 ? "negativo" : "neutro"}
              icono={<AlertTriangle className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Saldo del archivo"
              valor={formatearDineroCompacto(
                previsualizacion.resumen.ingresos - previsualizacion.resumen.egresos,
                moneda,
              )}
              detalle={`+${formatearDineroCompacto(previsualizacion.resumen.ingresos, moneda)} / −${formatearDineroCompacto(previsualizacion.resumen.egresos, moneda)}`}
            />
          </div>

          {previsualizacion.columnasFaltantes.length > 0 ? (
            <p className="text-sm text-destructive">
              Faltan columnas obligatorias: {previsualizacion.columnasFaltantes.join(", ")}.
            </p>
          ) : null}
          {previsualizacion.columnasDesconocidas.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Se ignoran columnas no reconocidas: {previsualizacion.columnasDesconocidas.join(", ")}
              .
            </p>
          ) : null}

          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Fila</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Diagnóstico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previsualizacion.filas.map((fila) => (
                  <TableRow
                    key={fila.numero}
                    className={cn(!fila.importable && "bg-danger-soft/40")}
                  >
                    <TableCell className="tabular-nums">{fila.numero}</TableCell>
                    <TableCell className="tabular-nums">{fila.crudo.fecha ?? "—"}</TableCell>
                    <TableCell>{fila.crudo.tipo ?? "—"}</TableCell>
                    <TableCell className="max-w-40 truncate">
                      {fila.crudo.categoria ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fila.datos
                        ? formatearDineroCompacto(fila.datos.valor, moneda)
                        : (fila.crudo.valor ?? "—")}
                    </TableCell>
                    <TableCell className="max-w-56 truncate">
                      {fila.crudo.descripcion ?? "—"}
                    </TableCell>
                    <TableCell>{fila.datos?.estado ?? "—"}</TableCell>
                    <TableCell className="max-w-72">
                      {fila.importable ? (
                        <Badge variant="outline" className="border-success/30 bg-success-soft">
                          Lista
                        </Badge>
                      ) : (
                        <ul className="space-y-0.5 text-xs text-destructive">
                          {fila.errores.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Al importar se registran solo las filas listas; las que tienen errores se omiten y el
            archivo se puede corregir y volver a cargar.
          </p>
        </div>
      ) : null}
    </div>
  );
}
