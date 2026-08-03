import type { Metadata } from "next";
import { BellRing, FolderPlus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina, CabeceraSeccion } from "@/shared/ui/cabeceras";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { leerVentana, resumirAgenda } from "@/modules/obligaciones/domain/agenda";
import { DialogoObligacion } from "@/modules/obligaciones/presentation/components/dialogo-obligacion";
import { PanelAgenda } from "@/modules/obligaciones/presentation/components/panel-agenda";
import { SelectorVentana } from "@/modules/obligaciones/presentation/components/selector-ventana";
import { TablaObligaciones } from "@/modules/obligaciones/presentation/components/tabla-obligaciones";

export const metadata: Metadata = { title: "Obligaciones" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** RF-50 a RF-58. */
export default async function PaginaObligaciones({ searchParams }: Props) {
  const parametros = await searchParams;
  const { contenedor, ajustes } = await contenedorPrivado();

  // RF-58: la ventana la elige el usuario (7, 30 o 90 dias) y viaja en la URL.
  const ventana = leerVentana(parametros.dias);

  const [obligaciones, agenda, proyectos, categorias, metodosPago] = await Promise.all([
    contenedor.obligaciones.listar.ejecutar({}),
    // La ventana incluye siempre lo ya vencido, que es lo que hay que ver primero.
    contenedor.obligaciones.listarAgenda.ejecutar({
      filtro: { dentroDeDias: ventana, incluirVencidas: true },
    }),
    contenedor.proyectos.listar.ejecutar({ filtro: { estados: ["activo", "pausado"] } }),
    contenedor.categorias.listar.ejecutar({}),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const hoy = contenedor.reloj.hoy();

  // Las cifras de la agenda las define el dominio, no esta página (ADR-11): las
  // mismas tres se necesitan aquí, en el panel y en el detalle de proyecto, y
  // tres derivaciones locales eran tres fórmulas que podían discrepar —y lo
  // hacían—. Ver `obligaciones/domain/agenda.ts`.
  const resumen = resumirAgenda(agenda, ajustes.moneda);

  // `tipoProyectoId` acota las categorias del dialogo: aqui se cargan todas
  // porque el proyecto se elige dentro del formulario.
  const opcionesProyecto = proyectos.map((p) => ({
    id: p.proyectoId,
    nombre: p.nombre,
    tipoProyectoId: p.tipoProyectoId,
  }));

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Compromisos"
        titulo="Obligaciones"
        descripcion="Pagos recurrentes y sus vencimientos. Pagar una ocurrencia crea el movimiento."
        acciones={
          <DialogoObligacion
            proyectos={opcionesProyecto}
            categorias={categorias}
            hoy={hoy}
            horizonteMeses={ajustes.horizonteProyeccionMeses}
            formatoFecha={ajustes.formatoFecha}
          />
        }
      />

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="Las obligaciones pertenecen a un proyecto. Crea uno para registrar sus compromisos."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <>
          {/*
            Cada tarjeta lleva el conteo Y el importe: «2 vencidas» y «$ 1,8 M»
            responden preguntas distintas, y antes solo se respondía la primera.
            Los importes salen de la misma medida que los subtotales del panel de
            abajo, así que no pueden discrepar de ellos.
          */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <TarjetaIndicador
              etiqueta="Obligaciones activas"
              valor={String(obligaciones.filter((o) => o.activa).length)}
              detalle={`de ${obligaciones.length} registrada(s)`}
            />
          </div>

          {/*
            El selector de ventana entra COMO ACCIÓN DEL PANEL y no en una fila
            propia encima: un control va en la cabecera del bloque que modifica, y
            el bloque lleva un solo rótulo.
          */}
          <PanelAgenda
            eventos={agenda}
            metodosPago={metodosPago}
            hoy={hoy}
            formatoFecha={ajustes.formatoFecha}
            moneda={ajustes.moneda}
            titulo={`Agenda · vencidas y próximas ${ventana} días`}
            accion={<SelectorVentana ventana={ventana} />}
            vacio={{
              titulo: `Sin vencimientos en ${ventana} días`,
              descripcion: "Las obligaciones activas generan sus ocurrencias automáticamente.",
            }}
          />

          <CabeceraSeccion
            titulo="Obligaciones registradas"
            descripcion="Cada obligación genera sus ocurrencias según su frecuencia."
          />

          {obligaciones.length === 0 ? (
            <EstadoVacio
              icono={<BellRing className="size-8" />}
              titulo="Aún no hay obligaciones"
              descripcion="Registra la cuota del crédito, la administración o el impuesto para no perderlos de vista."
            />
          ) : (
            <TablaObligaciones
              filas={obligaciones}
              categorias={categorias}
              hoy={hoy}
              horizonteMeses={ajustes.horizonteProyeccionMeses}
              formatoFecha={ajustes.formatoFecha}
            />
          )}
        </>
      )}
    </div>
  );
}
