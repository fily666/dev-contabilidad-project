import type { Metadata } from "next";

import { contenedorPrivado } from "@/di/container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { FormularioAjustes } from "@/modules/acceso/presentation/components/formulario-ajustes";
import { GestorCategorias } from "@/modules/categorias/presentation/components/gestor-categorias";
import { GestorMetodosPago } from "@/modules/categorias/presentation/components/gestor-metodos-pago";

export const metadata: Metadata = { title: "Configuración" };

/** RF-03, RF-30 a RF-34, RF-100. */
export default async function PaginaConfiguracion() {
  const { contenedor, ajustes } = await contenedorPrivado();

  const [categorias, metodosPago, tipos] = await Promise.all([
    contenedor.categorias.listar.ejecutar({
      // Se muestran tambien las ocultas para poder reactivarlas.
      filtro: { soloActivas: false },
    }),
    contenedor.metodosPago.listar(false),
    contenedor.proyectos.listarTipos.ejecutar(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Preferencias de la instalación y catálogos que alimentan el registro de movimientos.
        </p>
      </div>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="metodos">Métodos de pago</TabsTrigger>
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

        <TabsContent value="preferencias" className="mt-6">
          <FormularioAjustes ajustes={ajustes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
