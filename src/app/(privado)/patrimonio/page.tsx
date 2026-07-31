import type { Metadata } from "next";
import { Building2, FolderPlus, Landmark, Scale, TrendingUp } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { BarrasComparativas } from "@/shared/ui/viz/barras-comparativas";
import {
  formatearDineroCompacto,
  formatearFecha,
  formatearDinero,
  formatearPorcentaje,
} from "@/shared/utils/formato";
import { GestorPatrimonio } from "@/modules/patrimonio/presentation/components/gestor-patrimonio";

export const metadata: Metadata = { title: "Patrimonio" };

/** RF-16, RF-17, RF-78. */
export default async function PaginaPatrimonio() {
  const { contenedor, ajustes } = await contenedorPrivado();

  const [patrimonio, pasivos, valoraciones, proyectos] = await Promise.all([
    contenedor.patrimonio.obtener.ejecutar({}),
    contenedor.patrimonio.listarPasivos.ejecutar({}),
    contenedor.patrimonio.listarValoraciones.ejecutar({}),
    contenedor.proyectos.listar.ejecutar({ filtro: { estados: ["activo", "pausado"] } }),
  ]);

  const { consolidado } = patrimonio;
  const hoy = contenedor.reloj.hoy();

  return (
    <div className="space-y-8">
      <div>
        <p className="etiqueta-dato">Balance patrimonial</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Patrimonio</h1>
        <p className="text-sm text-muted-foreground">
          Activos por valoración, pasivos por saldo y el neto entre los dos. Lo invertido y lo que
          vale hoy son cifras distintas: aquí se ven las dos.
        </p>
      </div>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="El patrimonio se compone de las valoraciones y los pasivos de tus proyectos."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaIndicador
              etiqueta="Activos"
              valor={formatearDineroCompacto(consolidado.activos, consolidado.moneda)}
              detalle="Última valoración de cada proyecto"
              icono={<Building2 className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Pasivos"
              valor={formatearDineroCompacto(consolidado.pasivos, consolidado.moneda)}
              detalle="Saldo de los créditos vigentes"
              tono={consolidado.pasivos > 0 ? "advertencia" : "neutro"}
              icono={<Landmark className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Patrimonio neto"
              valor={formatearDineroCompacto(consolidado.patrimonioNeto, consolidado.moneda)}
              tono={consolidado.patrimonioNeto >= 0 ? "positivo" : "negativo"}
              detalle="Activos − pasivos"
              icono={<Scale className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Retorno total"
              valor={formatearPorcentaje(consolidado.retornoTotal, 1)}
              detalle="Resultado + plusvalía sobre lo invertido"
              tono={(consolidado.retornoTotal ?? 0) >= 0 ? "positivo" : "negativo"}
              icono={<TrendingUp className="size-4" />}
            />
          </div>

          {consolidado.sinValoracion > 0 ? (
            <p className="text-xs text-muted-foreground">
              {consolidado.sinValoracion} proyecto(s) sin valoración registrada: su activo no está
              contado en el total.
            </p>
          ) : null}

          <PanelGrafica
            titulo="Activo y pasivo por proyecto"
            descripcion="Lo que vale cada proyecto frente a lo que se debe por él."
            leyenda={[
              { etiqueta: "Valoración", serie: 1 },
              { etiqueta: "Pasivo", serie: 2 },
            ]}
          >
            {patrimonio.proyectos.length === 0 ? (
              <EstadoVacio
                titulo="Sin datos de patrimonio"
                descripcion="Registra una valoración o un pasivo para ver la comparación."
              />
            ) : (
              <BarrasComparativas
                categorias={patrimonio.proyectos.map((p) => ({
                  etiqueta: p.proyecto,
                  valores: [p.valoracionActual ?? 0, p.pasivoTotal],
                }))}
                series={[
                  { etiqueta: "Valoración", serie: 1 },
                  { etiqueta: "Pasivo", serie: 2 },
                ]}
                moneda={consolidado.moneda}
                tituloTabla="Activo y pasivo por proyecto"
              />
            )}
          </PanelGrafica>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Detalle por proyecto</h2>
            <div className="panel overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Invertido</TableHead>
                    <TableHead className="text-right">Valoración</TableHead>
                    <TableHead className="text-right">Pasivo</TableHead>
                    <TableHead className="text-right">Patrimonio neto</TableHead>
                    <TableHead className="text-right">Retorno</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patrimonio.proyectos.map((fila) => (
                    <TableRow key={fila.proyectoId}>
                      <TableCell className="max-w-56">
                        <p className="truncate font-medium">{fila.proyecto}</p>
                        <p className="text-xs text-muted-foreground">
                          {fila.valoracionFecha
                            ? `Valorado el ${formatearFecha(fila.valoracionFecha, ajustes.formatoFecha)}`
                            : "Sin valoración"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearDinero(fila.totalInvertido, fila.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fila.valoracionActual === null
                          ? "—"
                          : formatearDinero(fila.valoracionActual, fila.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearDinero(fila.pasivoTotal, fila.moneda)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatearDinero(fila.patrimonioNeto, fila.moneda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatearPorcentaje(fila.retorno, 1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <GestorPatrimonio
            proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
            pasivos={pasivos}
            valoraciones={valoraciones.filas}
            variacion={valoraciones.variacion}
            hoy={hoy}
            formatoFecha={ajustes.formatoFecha}
          />
        </>
      )}
    </div>
  );
}
