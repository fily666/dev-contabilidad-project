import type { Metadata } from "next";
import { AlertTriangle, PiggyBank, Receipt, Scale } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina } from "@/shared/ui/cabeceras";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { PanelGrafica } from "@/shared/ui/viz/panel-grafica";
import { BarrasComparativas } from "@/shared/ui/viz/barras-comparativas";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { formatearDineroCompacto, formatearPorcentaje } from "@/shared/utils/formato";
import { ritmoDeEjecucion } from "@/modules/presupuestos/domain/alertas";
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

  const [ejecucion, proyectos, categorias, tipos] = await Promise.all([
    contenedor.presupuestos.listarEjecucion.ejecutar({ filtro: { proyectoId } }),
    contenedor.proyectos.listar.ejecutar({ filtro: { estados: ["activo", "pausado"] } }),
    contenedor.categorias.listar.ejecutar({}),
    // Un presupuesto global abarca todos los tipos, y ahi conviven categorias
    // raiz con el mismo nombre: el selector las distingue con el tipo.
    contenedor.proyectos.listarTipos.ejecutar(),
  ]);

  const nombrePorTipo = Object.fromEntries(tipos.map((t) => [t.id, t.nombre]));

  const { filas, resumen } = ejecucion;
  const moneda = filas[0]?.moneda ?? ajustes.moneda;

  // Los del periodo que contiene hoy: es lo que interesa mirar primero.
  const vigentes = filas.filter((f) => f.periodoInicio <= hoy && f.periodoFin >= hoy);

  // Ritmo del periodo vigente más largo: es el que marca el paso del conjunto.
  const referencia = vigentes[0];
  const ritmo = referencia
    ? ritmoDeEjecucion({
        ejecucion: resumen.ejecucion,
        periodoInicio: referencia.periodoInicio,
        periodoFin: referencia.periodoFin,
        hoy,
      })
    : null;

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Planeación"
        titulo="Presupuestos"
        descripcion="Cuánto se planeó gastar frente a cuánto se gastó, con alerta al 80 % y al 100 %."
      />

      {/*
        La ejecución pasa a ser el valor PRINCIPAL de la primera tarjeta: es el
        indicador que responde la pregunta del módulo, y estaba en el `detalle` de
        12 px de la tarjeta «Ejecutado», debajo del importe.

        «Alertas» se partió en dos: mostraba `"2 / 3"` con el detalle «Excedidos /
        sobre el 80 %», dos magnitudes en un solo valor que no se podía colorear
        —el tono tenía que elegir una de las dos—, ni ordenar, ni leer de un
        vistazo.

        Y «Desviación» se retiró: es `ejecutado − planeado`, visible ya en las dos
        tarjetas contiguas y en cada barra de la tabla. Su hueco lo ocupa el ritmo.

        Sin ninguna partida definida, esta fila y la gráfica de debajo no se pintan:
        eran cuatro tarjetas en «—» y «$ 0» y un panel con su estado vacío, unos
        400 px de armazón para decir cuatro veces que no hay nada. Con la tabla
        vacía, el estado vacío del gestor —que sí lleva la acción— es la vista.
      */}
      {filas.length === 0 ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaIndicador
              etiqueta="Ejecución"
              valor={formatearPorcentaje(resumen.ejecucion, 0)}
              tono={
                resumen.ejecucion === null
                  ? "neutro"
                  : resumen.ejecucion > 1
                    ? "negativo"
                    : resumen.ejecucion >= 0.8
                      ? "advertencia"
                      : "positivo"
              }
              detalle={textoRitmo(ritmo)}
              icono={<Receipt className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Planeado"
              valor={formatearDineroCompacto(resumen.planeado, moneda)}
              detalle={`${filas.length} partida(s)`}
              icono={<PiggyBank className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Ejecutado"
              valor={formatearDineroCompacto(resumen.real, moneda)}
              detalle={`Desviación ${formatearDineroCompacto(resumen.desviacion, moneda)}`}
              tono={resumen.desviacion > 0 ? "negativo" : "positivo"}
              icono={<Scale className="size-4" />}
            />
            <TarjetaIndicador
              etiqueta="Excedidos"
              valor={String(resumen.excedidos)}
              detalle={`${resumen.enAviso} sobre el 80 %`}
              tono={
                resumen.excedidos > 0
                  ? "negativo"
                  : resumen.enAviso > 0
                    ? "advertencia"
                    : "positivo"
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
                denso
                titulo="Sin presupuestos vigentes"
                descripcion="Crea uno para el mes o el año en curso y aquí verás la comparación."
              />
            ) : (
              <BarrasComparativas
                categorias={vigentes.map((f) => ({
                  clave: f.presupuestoId,
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
        </>
      )}

      <GestorPresupuestos
        filas={filas}
        proyectos={proyectos.map((p) => ({
          id: p.proyectoId,
          nombre: p.nombre,
          tipoProyectoId: p.tipoProyectoId,
        }))}
        categorias={categorias}
        nombrePorTipo={nombrePorTipo}
        hoy={hoy}
        formatoFecha={ajustes.formatoFecha}
      />
    </div>
  );
}

/** El ritmo en palabras: un número suelto como «1,4×» no se interpreta solo. */
function textoRitmo(ritmo: number | null): string {
  if (ritmo === null) return "Sin periodo vigente";
  if (ritmo > 1.15) return `Ritmo ${ritmo.toFixed(1)}× · se gasta más rápido que pasa el periodo`;
  if (ritmo < 0.85) return `Ritmo ${ritmo.toFixed(1)}× · por debajo del paso del periodo`;
  return `Ritmo ${ritmo.toFixed(1)}× · al día con el periodo`;
}
