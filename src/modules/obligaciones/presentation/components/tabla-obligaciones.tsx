import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/cn";
import { ETIQUETA_FRECUENCIA } from "@/shared/utils/etiquetas";
import { formatearDinero, formatearFecha } from "@/shared/utils/formato";
import type { CategoriaConRuta } from "@/modules/categorias/domain/categoria.repository";
import type { ObligacionListada } from "../../domain/obligacion.repository";
import { AccionesObligacion } from "./acciones-obligacion";

type Props = {
  filas: ObligacionListada[];
  categorias: CategoriaConRuta[];
  hoy: string;
  horizonteMeses: number;
  formatoFecha?: string;
  ocultarProyecto?: boolean;
};

function etiquetaFrecuencia(fila: ObligacionListada): string {
  if (fila.frecuencia === "personalizada" && fila.intervaloMeses) {
    return `Cada ${fila.intervaloMeses} meses`;
  }
  return ETIQUETA_FRECUENCIA[fila.frecuencia];
}

/** RF-50, RF-57. En móvil la tabla se presenta como tarjetas (RNF-01). */
export function TablaObligaciones({
  filas,
  categorias,
  hoy,
  horizonteMeses,
  formatoFecha,
  ocultarProyecto,
}: Props) {
  return (
    <>
      <div className="panel hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              {ocultarProyecto ? null : <TableHead>Proyecto</TableHead>}
              <TableHead>Categoría</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead className="w-32">Próximo</TableHead>
              <TableHead className="text-right">Estimado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={fila.id} className={cn(!fila.activa && "opacity-60")}>
                <TableCell className="max-w-64">
                  <p className="truncate font-medium">{fila.concepto}</p>
                  {fila.ocurrenciasVencidas > 0 ? (
                    <p className="text-xs text-destructive">
                      {fila.ocurrenciasVencidas} vencida(s)
                    </p>
                  ) : null}
                </TableCell>
                {ocultarProyecto ? null : (
                  <TableCell className="max-w-40 truncate">{fila.proyectoNombre}</TableCell>
                )}
                <TableCell className="max-w-52 truncate text-sm text-muted-foreground">
                  {fila.categoria}
                </TableCell>
                <TableCell className="text-sm">{etiquetaFrecuencia(fila)}</TableCell>
                <TableCell className="tabular-nums">
                  {fila.proximoVencimiento
                    ? formatearFecha(fila.proximoVencimiento, formatoFecha)
                    : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatearDinero(fila.valorEstimado, fila.moneda)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      fila.activa
                        ? "border-success/30 bg-success-soft text-success-foreground"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {fila.activa ? "Activa" : "Suspendida"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <AccionesObligacion
                    obligacion={fila}
                    categorias={categorias}
                    hoy={hoy}
                    horizonteMeses={horizonteMeses}
                    formatoFecha={formatoFecha}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {filas.map((fila) => (
          <li key={fila.id} className={cn("panel p-4", !fila.activa && "opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{fila.concepto}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ocultarProyecto ? fila.categoria : `${fila.proyectoNombre} · ${fila.categoria}`}
                </p>
              </div>
              <AccionesObligacion
                obligacion={fila}
                categorias={categorias}
                hoy={hoy}
                horizonteMeses={horizonteMeses}
                formatoFecha={formatoFecha}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {etiquetaFrecuencia(fila)}
                {fila.proximoVencimiento
                  ? ` · ${formatearFecha(fila.proximoVencimiento, formatoFecha)}`
                  : ""}
              </span>
              <span className="font-medium tabular-nums">
                {formatearDinero(fila.valorEstimado, fila.moneda)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
