import type { Metadata } from "next";
import { contenedorAutenticado } from "@/di/container";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { GestorCategorias } from "@/modules/categorias/presentation/components/gestor-categorias";
import { GestorMetodosPago } from "@/modules/categorias/presentation/components/gestor-metodos-pago";

export const metadata: Metadata = { title: "Configuración" };

/** RF-30 a RF-34, RF-100. */
export default async function PaginaConfiguracion() {
  const { contenedor, sesion } = await contenedorAutenticado();

  const [categorias, metodosPago, tipos] = await Promise.all([
    contenedor.categorias.listar.ejecutar({
      propietarioId: sesion.usuarioId,
      // Se muestran tambien las ocultas para poder reactivarlas.
      filtro: { soloActivas: false },
    }),
    contenedor.metodosPago.listar(sesion.usuarioId, false),
    contenedor.proyectos.listarTipos.ejecutar({ propietarioId: sesion.usuarioId }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Catálogos que alimentan el registro de movimientos.
        </p>
      </div>

      <Tabs defaultValue="categorias">
        <TabsList>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="metodos">Métodos de pago</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
