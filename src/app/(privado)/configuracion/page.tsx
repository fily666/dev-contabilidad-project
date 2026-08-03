import { Suspense } from "react";
import type { Metadata } from "next";
import { Download, Upload } from "lucide-react";

import { EnlaceBoton } from "@/shared/ui/enlace-boton";

import { contenedorPrivado } from "@/di/container";
import { CabeceraPagina } from "@/shared/ui/cabeceras";
import { PestanasEnUrl } from "@/shared/ui/pestanas-url";
import { Skeleton } from "@/shared/ui/skeleton";
import { TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { FormularioAjustes } from "@/modules/acceso/presentation/components/formulario-ajustes";
import { GestorCategorias } from "@/modules/categorias/presentation/components/gestor-categorias";
import { GestorMetodosPago } from "@/modules/metodos-pago/presentation/components/gestor-metodos-pago";
import { GestorTiposProyecto } from "@/modules/proyectos/presentation/components/gestor-tipos-proyecto";

export const metadata: Metadata = { title: "Configuración" };

/** Secciones de la vista. Viajan en `?seccion=` para sobrevivir a una recarga. */
const SECCIONES = ["categorias", "metodos", "tipos", "preferencias", "datos"] as const;

/** RF-03, RF-30 a RF-34, RF-100 a RF-103. */
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

  // Los contadores salen de los datos que la vista ya tiene: saber cuantas
  // categorias hay —y cuantas estan ocultas— exigia abrir la pestaña y contar.
  const ocultas = categorias.filter((c) => !c.activa).length;

  return (
    <div className="space-y-6">
      <CabeceraPagina
        ambito="Ajustes"
        titulo="Configuración"
        descripcion="Preferencias de la instalación y catálogos que alimentan el registro de movimientos."
      />

      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PestanasEnUrl porOmision="categorias" valores={SECCIONES}>
          <TabsList>
            <TabsTrigger value="categorias">
              Categorías <Contador n={categorias.length} />
            </TabsTrigger>
            <TabsTrigger value="metodos">
              Métodos <Contador n={metodosPago.length} />
            </TabsTrigger>
            <TabsTrigger value="tipos">
              Tipos <Contador n={tipos.length} />
            </TabsTrigger>
            <TabsTrigger value="preferencias">Preferencias</TabsTrigger>
            <TabsTrigger value="datos">Datos</TabsTrigger>
          </TabsList>

          <TabsContent value="categorias" className="mt-6 space-y-3">
            {ocultas > 0 ? (
              <p className="text-xs text-muted-foreground">
                {ocultas} categoría(s) oculta(s), visibles aquí para poder reactivarlas. No aparecen
                al registrar un movimiento.
              </p>
            ) : null}
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

          <TabsContent value="preferencias" className="mt-6">
            <FormularioAjustes ajustes={ajustes} />
          </TabsContent>

          {/*
            Entrada y salida de datos, juntas.

            La exportación (RF-103) vivía dentro de «Preferencias», que no es donde
            se busca: exportar todo no es una preferencia, es una operación sobre los
            datos. Y la importación (RF-27) no estaba en ningún menú —solo se
            alcanzaba desde un botón secundario en Movimientos—, así que una fase 5
            completa era invisible a menos que uno tropezara con ella.
          */}
          <TabsContent value="datos" className="mt-6 space-y-4">
            <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="font-medium">Importar movimientos desde CSV</p>
                <p className="max-w-prose text-sm text-muted-foreground">
                  Se valida fila por fila y se previsualiza antes de escribir. Las categorías y los
                  métodos de pago se buscan por nombre.
                </p>
              </div>
              <EnlaceBoton href="/movimientos/importar" variant="secondary">
                <Upload className="size-4" aria-hidden /> Ir a importar
              </EnlaceBoton>
            </div>

            <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="font-medium">Exportar todos los datos</p>
                <p className="max-w-prose text-sm text-muted-foreground">
                  Un JSON con proyectos, movimientos, obligaciones, documentos, pasivos,
                  valoraciones y presupuestos. Los archivos de soporte no van dentro: se descargan
                  por su enlace.
                </p>
              </div>
              <EnlaceBoton href="/api/exportar/datos" variant="secondary">
                <Download className="size-4" aria-hidden /> Descargar JSON
              </EnlaceBoton>
            </div>
          </TabsContent>
        </PestanasEnUrl>
      </Suspense>
    </div>
  );
}

/** Recuento junto al nombre de la pestaña, en versalitas discretas. */
function Contador({ n }: { n: number }) {
  return <span className="font-mono text-[0.65rem] text-muted-foreground">{n}</span>;
}
