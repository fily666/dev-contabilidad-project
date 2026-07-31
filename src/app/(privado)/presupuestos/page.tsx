import type { Metadata } from "next";
import { AlertTriangle, PiggyBank, Receipt, Scale } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { BarrasComparativas } from "@/shared/ui/viz/barras-comparativas";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { formatearDineroCompacto, formatearPorcentaje } from "@/shared/utils/formato";
import { GestorPresupuestos } from "@/modules/presupuestos/presentation/components/gestor-presupuestos";

export const metadata: Metadata = { title: "Presupuestos" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function primero(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && v.trim() !== "" ? v : undefined;
}

/** RF-80 a RF-83. */
export default async function PaginaPresupuestos({ searchParams }: Props) {
  const parametros = await searchParams;
  const { contenedor, ajustes } = await contenedorPrivado();

  const hoy = contenedor.reloj.hoy();
  const proyectoId = primero(parametros.proyectoId);

  const [ejecucion, proyectos, categorias] = await Promise.all([
    contenedor.presupuestos.listarEjecucion.ejecutar({ filtro: { proyectoId } }),
    contenedor.proyectos.listar.ejecutar({ filtro: { estados: ["activo", "pausado"] } }),
    contenedor.categorias.listar.ejecutar({}),
  ]);

  const { filas, resumen } = ejecucion;
  const moneda = filas[0]?.moneda ?? ajustes.moneda;

  // Los del periodo que contiene hoy: es lo que interesa mirar primero.
  const vigentes = filas.filter((f) => f.periodoInicio <= hoy && f.periodoFin >= hoy);

  return (
    <div className="space-y-8">
      <div>
        <p className="etiqueta-dato">Planeación</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Presupuestos</h1>
        <p className="text-sm text-muted-foreground">
          Cuánto se planeó gastar frente a cuánto se gastó, con alerta al 80 % y al 100 %.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador
          etiqueta="Planeado"
          valor={formatearDineroCompacto(resumen.planeado, moneda)}
          detalle={`${filas.length} presupuesto(s)`}
          icono={<PiggyBank className="size-4" />}
        />
        <TarjetaIndicador
          etiqueta="Ejecutado"
          valor={formatearDineroCompacto(resumen.real, moneda)}
          detalle={formatearPorcentaje(resumen.ejecucion, 1)}
          icono={<Receipt className="size-4" />}
        />
        <TarjetaIndicador
          etiqueta="Desviación"
          valor={formatearDineroCompacto(resumen.desviacion, moneda)}
          tono={resumen.desviacion > 0 ? "negativo" : "positivo"}
          detalle={resumen.desviacion > 0 ? "Por encima del plan" : "Dentro del plan"}
          icono={<Scale className="size-4" />}
        />
        <TarjetaIndicador
          etiqueta="Alertas"
          valor={`${resumen.excedidos} / ${resumen.enAviso}`}
          detalle="Excedidos / sobre el 80 %"
          tono={
            resumen.excedidos > 0 ? "negativo" : resumen.enAviso > 0 ? "advertencia" : "positivo"
          }
          icono={<AlertTriangle className="size-4" />}
        />
      </div>

      <PanelGrafica
        titulo="Planeado contra real del periodo vigente"
        descripcion="Solo los presupuestos cuyo periodo incluye hoy."
        leyenda={[
          { etiqueta: "Planeado", serie: 1 },
          { etiqueta: "Real", serie: 2 },
        ]}
      >
        {vigentes.length === 0 ? (
          <EstadoVacio
            titulo="Sin presupuestos vigentes"
            descripcion="Crea uno para el mes o el año en curso y aquí verás la comparación."
          />
        ) : (
          <BarrasComparativas
            categorias={vigentes.map((f) => ({
              etiqueta: f.categoria,
              valores: [f.valorPlaneado, f.valorReal],
            }))}
            series={[
              { etiqueta: "Planeado", serie: 1 },
              { etiqueta: "Real", serie: 2 },
            ]}
            moneda={moneda}
            tituloTabla="Planeado contra real por categoría"
          />
        )}
      </PanelGrafica>

      <GestorPresupuestos
        filas={filas}
        proyectos={proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }))}
        categorias={categorias}
        hoy={hoy}
        formatoFecha={ajustes.formatoFecha}
      />
    </div>
  );
}
