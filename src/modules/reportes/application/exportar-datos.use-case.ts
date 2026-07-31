import type { Reloj } from "@/shared/domain/reloj";
import type { Ajustes } from "@/modules/acceso/domain/sesion";
import type { CategoriaRepository } from "@/modules/categorias/domain/categoria.repository";
import type { MetodoPagoRepository } from "@/modules/metodos-pago/domain/metodo-pago.repository";
import type { ProyectoRepository } from "@/modules/proyectos/domain/proyecto.repository";
import type { TipoProyectoRepository } from "@/modules/proyectos/domain/tipo-proyecto.repository";
import type { ListarMovimientos } from "@/modules/movimientos/application/listar-movimientos.use-case";
import type { ObligacionRepository } from "@/modules/obligaciones/domain/obligacion.repository";
import type { DocumentoRepository } from "@/modules/documentos/domain/documento.repository";
import type {
  PasivoRepository,
  ValoracionRepository,
} from "@/modules/patrimonio/domain/patrimonio.repository";
import type { PresupuestoRepository } from "@/modules/presupuestos/domain/presupuesto.repository";

/**
 * RF-103: exportación completa de los datos en JSON.
 *
 * Es la puerta de salida del sistema, y existe por una razón concreta: los datos
 * son del dueño, no de la aplicación. Se arma con los mismos puertos que usa todo
 * lo demás —no con un `select *` paralelo— así que lo que sale es exactamente lo
 * que la aplicación considera cierto, incluidos los estados efectivos.
 *
 * No incluye los archivos de Storage: van aparte, por URL firmada (RF-45). Se
 * exporta su metadato para poder emparejarlos después.
 */
export type ExportacionCompleta = {
  version: 1;
  generadoEn: string;
  ajustes: Ajustes;
  tiposProyecto: unknown[];
  proyectos: unknown[];
  categorias: unknown[];
  metodosPago: unknown[];
  movimientos: unknown[];
  obligaciones: unknown[];
  documentos: unknown[];
  pasivos: unknown[];
  valoraciones: unknown[];
  presupuestos: unknown[];
  totales: Record<string, number>;
};

export class ExportarDatos {
  constructor(
    private readonly deps: {
      ajustes: () => Promise<Ajustes>;
      tipos: TipoProyectoRepository;
      proyectos: ProyectoRepository;
      categorias: CategoriaRepository;
      metodosPago: MetodoPagoRepository;
      movimientos: ListarMovimientos;
      obligaciones: ObligacionRepository;
      documentos: DocumentoRepository;
      pasivos: PasivoRepository;
      valoraciones: ValoracionRepository;
      presupuestos: PresupuestoRepository;
      reloj: Reloj;
    },
  ) {}

  async ejecutar(): Promise<ExportacionCompleta> {
    const d = this.deps;

    const [
      ajustes,
      tiposProyecto,
      proyectos,
      categorias,
      metodosPago,
      movimientos,
      obligaciones,
      documentos,
      pasivos,
      valoraciones,
      presupuestos,
    ] = await Promise.all([
      d.ajustes(),
      d.tipos.listarTodos(),
      d.proyectos.listar({ estados: ["activo", "pausado", "finalizado", "archivado"] }),
      d.categorias.listar({ soloActivas: false }),
      d.metodosPago.listar(false),
      // Tope alto pero acotado: una exportación no debe poder tumbar el proceso.
      d.movimientos.ejecutar({ paginacion: { pagina: 1, porPagina: 100 } }),
      d.obligaciones.listar(),
      d.documentos.listar(),
      d.pasivos.listar(),
      d.valoraciones.listar(),
      d.presupuestos.listarEjecucion(),
    ]);

    // Los movimientos se paginan: se recorren todas las páginas para que la
    // exportación sea completa y no un recorte silencioso.
    const filasMovimientos = [...movimientos.filas];
    const paginas = Math.ceil(movimientos.total / movimientos.porPagina);
    for (let pagina = 2; pagina <= paginas; pagina += 1) {
      const siguiente = await d.movimientos.ejecutar({
        paginacion: { pagina, porPagina: movimientos.porPagina },
      });
      filasMovimientos.push(...siguiente.filas);
    }

    return {
      version: 1,
      generadoEn: d.reloj.ahora().toISOString(),
      ajustes,
      tiposProyecto: tiposProyecto.map((t) => ({
        id: t.id,
        codigo: t.codigo,
        nombre: t.nombre,
        esSistema: t.esSistema,
        activo: t.activo,
        configuracion: t.configuracion,
      })),
      proyectos,
      categorias,
      metodosPago,
      movimientos: filasMovimientos,
      obligaciones,
      documentos,
      pasivos,
      valoraciones,
      presupuestos,
      totales: {
        proyectos: proyectos.length,
        movimientos: filasMovimientos.length,
        obligaciones: obligaciones.length,
        documentos: documentos.length,
        pasivos: pasivos.length,
        valoraciones: valoraciones.length,
        presupuestos: presupuestos.length,
        ingresos: movimientos.totales.ingresos,
        egresos: movimientos.totales.egresos,
        invertido: movimientos.totales.invertido,
      },
    };
  }
}
