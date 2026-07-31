import type { Metadata } from "next";
import { Download } from "lucide-react";

import { EnlaceBoton } from "@/shared/ui/enlace-boton";

import { contenedorPrivado } from "@/di/container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { FormularioAjustes } from "@/modules/acceso/presentation/components/formulario-ajustes";
import { GestorCategorias } from "@/modules/categorias/presentation/components/gestor-categorias";
import { GestorMetodosPago } from "@/modules/metodos-pago/presentation/components/gestor-metodos-pago";
import { GestorTiposProyecto } from "@/modules/proyectos/presentation/components/gestor-tipos-proyecto";

export const metadata: Metadata = { title: "Configuración" };

/** RF-03, RF-30 a RF-34, RF-100, RF-101. */
export default async function PaginaConfiguracion() {
  const { contenedor, ajustes } = await contenedorPrivado();

  const [categorias, metodosPago, tipos] = await Promise.all([
    contenedor.categorias.listar.ejecutar({
      // Se muestran tambien las ocultas para poder reactivarlas.
      filtro: { soloActivas: false },
    }),
    contenedor.metodosPago.listar.ejecutar({ soloActivos: false }),
    // RF-100: incluidos los ocultos, para poder reactivarlos.
    contenedor.proyectos.listarTodosLosTipos.ejecutar(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="etiqueta-dato">Ajustes</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Preferencias de la instalación y catálogos que alimentan el registro de movimientos.
        </p>
      </div>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="metodos">Métodos de pago</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de proyecto</TabsTrigger>
          <TabsTrigger value="preferencias">Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="categorias" className="mt-6">
          <GestorCategorias
            categorias={categorias}
            tipos={tipos.map((t) => ({ id: t.id, nombre: t.nombre }))}
          />
        </TabsContent>

        <TabsContent value="metodos" className="mt-6">
          <GestorMetodosPago metodos={metodosPago} />
        </TabsContent>

        <TabsContent value="tipos" className="mt-6">
          <GestorTiposProyecto
            tipos={tipos.map((t) => ({
              id: t.id,
              codigo: t.codigo,
              nombre: t.nombre,
              icono: t.icono,
              esSistema: t.esSistema,
              activo: t.activo,
              atributos: t.configuracion.atributos,
              indicadores: t.configuracion.indicadores,
              generaIngresos: t.configuracion.generaIngresos,
              seValoriza: t.configuracion.seValoriza,
            }))}
          />
        </TabsContent>

        <TabsContent value="preferencias" className="mt-6 space-y-6">
          <FormularioAjustes ajustes={ajustes} />

          {/* RF-103: los datos son del dueño y tienen que poder salir. */}
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium">Exportar todos los datos</p>
              <p className="text-sm text-muted-foreground">
                Un JSON con proyectos, movimientos, obligaciones, documentos, pasivos, valoraciones
                y presupuestos. Los archivos de soporte no van dentro: se descargan por su enlace.
              </p>
            </div>
            <EnlaceBoton href="/api/exportar/datos" variant="secondary">
              <Download className="size-4" aria-hidden /> Descargar JSON
            </EnlaceBoton>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
