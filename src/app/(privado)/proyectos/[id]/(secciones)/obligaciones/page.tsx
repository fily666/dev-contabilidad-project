import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BellRing } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { leerVentana, resumirAgenda } from "@/modules/obligaciones/domain/agenda";
import { DialogoObligacion } from "@/modules/obligaciones/presentation/components/dialogo-obligacion";
import { PanelAgenda } from "@/modules/obligaciones/presentation/components/panel-agenda";
import { SelectorVentana } from "@/modules/obligaciones/presentation/components/selector-ventana";
import { TablaObligaciones } from "@/modules/obligaciones/presentation/components/tabla-obligaciones";

export const metadata: Metadata = { title: "Obligaciones del proyecto" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** RF-15, RF-50 a RF-58 en el ámbito de un proyecto. */
export default async function PaginaObligacionesProyecto({ params, searchParams }: Props) {
  const [{ id }, parametros] = await Promise.all([params, searchParams]);
  const { contenedor, ajustes } = await contenedorPrivado();

  // La MISMA ventana y el mismo control que en la vista global: esta pagina la
  // tenia fija en 90 dias y el detalle del proyecto en 30, sin que nada explicara
  // por que la respuesta cambiaba segun por donde se entrara (RF-58).
  const ventana = leerVentana(parametros.dias);

  const proyecto = await contenedor.proyectos.obtener.buscar({ id });
  if (!proyecto) notFound();

  const [obligaciones, agenda, categorias, metodosPago] = await Promise.all([
    contenedor.obligaciones.listar.ejecutar({ filtro: { proyectoId: id } }),
    contenedor.obligaciones.listarAgenda.ejecutar({
      filtro: { proyectoId: id, dentroDeDias: ventana, incluirVencidas: true },
    }),
    contenedor.categorias.listar.ejecutar({
      filtro: { tipoProyectoId: proyecto.tipoProyectoId },
    }),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const hoy = contenedor.reloj.hoy();
  const resumen = resumirAgenda(agenda, proyecto.moneda);

  return (
    <div className="space-y-6">
      {/*
        La cabecera y las pestañas van en el layout de `(secciones)`. El alta de
        obligación se queda aquí, junto a la lista que modifica, y no en la
        cabecera compartida: es la acción propia de esta sección.
      */}
      {/*
        Tres indicadores donde no había ninguno: era la única vista de datos del
        producto que iba de la cabecera directa a una lista, así que saber cuánto
        se debía exigía contar filas a mano. Salen del mismo `resumirAgenda` que
        alimenta la vista global y los subtotales del panel.
      */}
      <div className="grid gap-3 sm:grid-cols-3">
        <TarjetaIndicador
          etiqueta="Vencidas"
          valor={String(resumen.vencidas)}
          detalle={
            resumen.vencidas > 0
              ? `${formatearDineroCompacto(resumen.importeVencido, resumen.moneda)} sin pagar`
              : "Ninguna vencida"
          }
          tono={resumen.vencidas > 0 ? "negativo" : "positivo"}
        />
        <TarjetaIndicador
          etiqueta="Vencen en 7 días"
          valor={String(resumen.proximas7)}
          detalle={formatearDineroCompacto(resumen.importe7, resumen.moneda)}
          tono={resumen.proximas7 > 0 ? "advertencia" : "neutro"}
        />
        <TarjetaIndicador
          etiqueta={`Comprometido a ${ventana} días`}
          valor={formatearDineroCompacto(resumen.importePorVencer, resumen.moneda)}
          detalle={`${resumen.porVencer} vencimiento(s) por pagar`}
        />
      </div>

      {/*
        El selector de ventana viaja DENTRO del panel que cambia, igual que en la
        vista global: estaba en una fila propia encima, emparejado con el botón de
        alta —dos controles sin relación entre sí compartiendo renglón—.
      */}
      <PanelAgenda
        eventos={agenda}
        metodosPago={metodosPago}
        hoy={hoy}
        formatoFecha={ajustes.formatoFecha}
        moneda={proyecto.moneda}
        titulo={`Agenda · vencidas y próximas ${ventana} días`}
        accion={<SelectorVentana ventana={ventana} />}
        ocultarProyecto
        vacio={{
          titulo: `Sin vencimientos en ${ventana} días`,
          descripcion: "Este proyecto no tiene ocurrencias pendientes en la ventana consultada.",
        }}
      />

      <CabeceraSeccion
        titulo="Obligaciones del proyecto"
        acciones={
          <DialogoObligacion
            proyectos={[{ id: proyecto.id, nombre: proyecto.nombre }]}
            categorias={categorias}
            hoy={hoy}
            horizonteMeses={ajustes.horizonteProyeccionMeses}
            formatoFecha={ajustes.formatoFecha}
            proyectoFijo={proyecto.id}
          />
        }
      />

      {obligaciones.length === 0 ? (
        <EstadoVacio
          icono={<BellRing className="size-8" />}
          titulo="Este proyecto no tiene obligaciones"
          descripcion="Registra sus pagos recurrentes: cuota del crédito, administración, impuestos o seguros."
        />
      ) : (
        <TablaObligaciones
          filas={obligaciones}
          categorias={categorias}
          hoy={hoy}
          horizonteMeses={ajustes.horizonteProyeccionMeses}
          formatoFecha={ajustes.formatoFecha}
          ocultarProyecto
        />
      )}
    </div>
  );
}
