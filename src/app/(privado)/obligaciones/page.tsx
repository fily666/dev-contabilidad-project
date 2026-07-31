import type { Metadata } from "next";
import { BellRing, FolderPlus } from "lucide-react";

import { contenedorPrivado } from "@/di/container";
import { EnlaceBoton } from "@/shared/ui/enlace-boton";
import { EstadoVacio } from "@/shared/ui/estado-vacio";
import { TarjetaIndicador } from "@/shared/ui/tarjeta-indicador";
import { formatearDineroCompacto } from "@/shared/utils/formato";
import { DialogoObligacion } from "@/modules/obligaciones/presentation/components/dialogo-obligacion";
import { PanelAgenda } from "@/modules/obligaciones/presentation/components/panel-agenda";
import { TablaObligaciones } from "@/modules/obligaciones/presentation/components/tabla-obligaciones";

export const metadata: Metadata = { title: "Obligaciones" };

/** RF-50 a RF-58. */
export default async function PaginaObligaciones() {
  const { contenedor, ajustes } = await contenedorPrivado();

  const [obligaciones, agenda, proyectos, categorias, metodosPago] = await Promise.all([
    contenedor.obligaciones.listar.ejecutar({}),
    // RF-58: la ventana de 30 dias incluye lo ya vencido, que es lo que hay que
    // ver primero.
    contenedor.obligaciones.listarAgenda.ejecutar({
      filtro: { dentroDeDias: 30, incluirVencidas: true },
    }),
    contenedor.proyectos.listar.ejecutar({ filtro: { estados: ["activo", "pausado"] } }),
    contenedor.categorias.listar.ejecutar({}),
    contenedor.metodosPago.listar.ejecutar(),
  ]);

  const hoy = contenedor.reloj.hoy();
  const moneda = proyectos[0]?.moneda ?? ajustes.moneda;

  const vencidas = agenda.filter((e) => e.diasRestantes < 0);
  const proximas7 = agenda.filter((e) => e.diasRestantes >= 0 && e.diasRestantes <= 7);
  const comprometido30 = agenda
    .filter((e) => e.diasRestantes >= 0)
    .reduce((suma, e) => suma + e.valorEstimado, 0);

  const opcionesProyecto = proyectos.map((p) => ({ id: p.proyectoId, nombre: p.nombre }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="etiqueta-dato">Compromisos</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Obligaciones</h1>
          <p className="text-sm text-muted-foreground">
            Pagos recurrentes y sus vencimientos. Pagar una ocurrencia crea el movimiento.
          </p>
        </div>
        <DialogoObligacion
          proyectos={opcionesProyecto}
          categorias={categorias}
          hoy={hoy}
          horizonteMeses={ajustes.horizonteProyeccionMeses}
          formatoFecha={ajustes.formatoFecha}
        />
      </div>

      {proyectos.length === 0 ? (
        <EstadoVacio
          icono={<FolderPlus className="size-8" />}
          titulo="Primero crea un proyecto"
          descripcion="Las obligaciones pertenecen a un proyecto. Crea uno para registrar sus compromisos."
          accion={<EnlaceBoton href="/proyectos/nuevo">Crear proyecto</EnlaceBoton>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <TarjetaIndicador
              etiqueta="Vencidas"
              valor={String(vencidas.length)}
              detalle={vencidas.length > 0 ? "Requieren atención inmediata" : "Ninguna vencida"}
              tono={vencidas.length > 0 ? "negativo" : "positivo"}
            />
            <TarjetaIndicador
              etiqueta="Vencen en 7 días"
              valor={String(proximas7.length)}
              detalle="Próximas a vencer"
            />
            <TarjetaIndicador
              etiqueta="Comprometido a 30 días"
              valor={formatearDineroCompacto(comprometido30, moneda)}
              detalle="Suma de vencimientos pendientes"
            />
          </div>

          <PanelAgenda
            eventos={agenda}
            metodosPago={metodosPago}
            hoy={hoy}
            formatoFecha={ajustes.formatoFecha}
            vacio={{
              titulo: "Sin vencimientos en 30 días",
              descripcion: "Las obligaciones activas generan sus ocurrencias automáticamente.",
            }}
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
