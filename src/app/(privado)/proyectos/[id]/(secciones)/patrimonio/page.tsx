import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { contenedorPrivado } from "@/di/container";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto, formatearPorcentaje } from "@/shared/utils/formato";
import { GestorPatrimonio } from "@/modules/patrimonio/presentation/components/gestor-patrimonio";

export const metadata: Metadata = { title: "Patrimonio del proyecto" };

type Props = { params: Promise<{ id: string }> };

/** RF-16, RF-17, RF-78 en el ámbito de un proyecto. */
export default async function PaginaPatrimonioProyecto({ params }: Props) {
  const { id } = await params;
  const { contenedor, ajustes } = await contenedorPrivado();

  const proyecto = await contenedor.proyectos.obtener.buscar({ id });
  if (!proyecto) notFound();

  const [patrimonio, pasivos, valoraciones] = await Promise.all([
    contenedor.patrimonio.obtener.ejecutar({ proyectoId: id }),
    contenedor.patrimonio.listarPasivos.ejecutar({ proyectoId: id }),
    contenedor.patrimonio.listarValoraciones.ejecutar({ proyectoId: id }),
  ]);

  const fila = patrimonio.proyectos[0];
  const hoy = contenedor.reloj.hoy();
  const moneda = fila?.moneda ?? proyecto.moneda;

  return (
    <div className="space-y-6">
      {/* Cabecera y pestañas en el layout de `(secciones)`. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador
          etiqueta="Valoración actual"
          valor={
            fila?.valoracionActual === null || fila?.valoracionActual === undefined
              ? "—"
              : formatearDineroCompacto(fila.valoracionActual, moneda)
          }
          detalle="Última registrada"
        />
        <TarjetaIndicador
          etiqueta="Pasivo"
          valor={formatearDineroCompacto(fila?.pasivoTotal ?? 0, moneda)}
          detalle="Saldo de créditos vigentes"
          tono={(fila?.pasivoTotal ?? 0) > 0 ? "advertencia" : "neutro"}
        />
        <TarjetaIndicador
          etiqueta="Patrimonio neto"
          valor={formatearDineroCompacto(fila?.patrimonioNeto ?? 0, moneda)}
          tono={(fila?.patrimonioNeto ?? 0) >= 0 ? "positivo" : "negativo"}
          detalle="Valoración − pasivo"
        />
        <TarjetaIndicador
          etiqueta="Retorno total"
          valor={formatearPorcentaje(fila?.retorno ?? null, 1)}
          detalle="Resultado + plusvalía sobre lo invertido"
        />
      </div>

      <GestorPatrimonio
        proyectos={[{ id: proyecto.id, nombre: proyecto.nombre }]}
        pasivos={pasivos}
        valoraciones={valoraciones.filas}
        variacion={valoraciones.variacion}
        hoy={hoy}
        formatoFecha={ajustes.formatoFecha}
        proyectoFijo={proyecto.id}
      />
    </div>
  );
}
