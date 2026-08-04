import { randomUUID } from "node:crypto";

import { RelojDelSistema } from "@/shared/infrastructure/reloj-del-sistema";
import { crearClienteServidor } from "@/shared/infrastructure/supabase/cliente-servidor";

import {
  ActualizarAjustes,
  CerrarSesion,
  IniciarSesion,
  VerificarSesion,
} from "@/modules/acceso/application/casos-de-uso";
import { AJUSTES_POR_OMISION, type Ajustes } from "@/modules/acceso/domain/sesion";
import { crearAlmacenSesion } from "@/modules/acceso/infrastructure/almacen-sesion-cookies";
import { controlDeIntentos } from "@/modules/acceso/infrastructure/control-intentos-compartido";
import { credencialDelEntorno } from "@/modules/acceso/infrastructure/credencial-entorno";
import { SupabaseAjustesRepository } from "@/modules/acceso/infrastructure/supabase-ajustes.repository";

import { SupabaseCategoriaRepository } from "@/modules/categorias/infrastructure/supabase-categoria.repository";
import {
  ActualizarCategoria,
  CambiarEstadoCategoria,
  CrearCategoria,
  EliminarCategoria,
  ListarCategorias,
} from "@/modules/categorias/application/casos-de-uso";

import { SupabaseMetodoPagoRepository } from "@/modules/metodos-pago/infrastructure/supabase-metodo-pago.repository";
import {
  ActualizarMetodoPago,
  CrearMetodoPago,
  EliminarMetodoPago,
  ListarMetodosPago,
} from "@/modules/metodos-pago/application/casos-de-uso";

import { SupabaseProyectoRepository } from "@/modules/proyectos/infrastructure/supabase-proyecto.repository";
import { SupabaseTipoProyectoRepository } from "@/modules/proyectos/infrastructure/supabase-tipo-proyecto.repository";
import { CrearProyecto } from "@/modules/proyectos/application/crear-proyecto.use-case";
import { ActualizarProyecto } from "@/modules/proyectos/application/actualizar-proyecto.use-case";
import { CambiarEstadoProyecto } from "@/modules/proyectos/application/cambiar-estado-proyecto.use-case";
import { EliminarProyecto } from "@/modules/proyectos/application/eliminar-proyecto.use-case";
import { ListarProyectos } from "@/modules/proyectos/application/listar-proyectos.use-case";
import { ListarTiposProyecto } from "@/modules/proyectos/application/listar-tipos-proyecto.use-case";
import {
  ActualizarTipoProyecto,
  CambiarEstadoTipoProyecto,
  CrearTipoProyecto,
  EliminarTipoProyecto,
  ListarTodosLosTipos,
} from "@/modules/proyectos/application/administrar-tipos-proyecto.use-case";
import { ObtenerProyecto } from "@/modules/proyectos/application/obtener-proyecto.use-case";
import { ObtenerResumenProyecto } from "@/modules/proyectos/application/obtener-resumen-proyecto.use-case";
import { ObtenerSemaforos } from "@/modules/proyectos/application/obtener-semaforos.use-case";

import { ObtenerCalendario } from "@/modules/calendario/application/obtener-calendario.use-case";

import {
  SupabasePasivoRepository,
  SupabaseValoracionRepository,
} from "@/modules/patrimonio/infrastructure/supabase-patrimonio.repository";
import {
  AbonarACapital,
  ActualizarPasivo,
  CambiarEstadoPasivo,
  EliminarPasivo,
  EliminarValoracion,
  ListarPasivos,
  ListarValoraciones,
  ObtenerPatrimonio,
  RegistrarPasivo,
  RegistrarValoracion,
} from "@/modules/patrimonio/application/casos-de-uso";

import { SupabasePresupuestoRepository } from "@/modules/presupuestos/infrastructure/supabase-presupuesto.repository";
import {
  ActualizarPresupuesto,
  CopiarPresupuestos,
  CrearPresupuesto,
  EliminarPresupuesto,
  ListarEjecucionPresupuestos,
} from "@/modules/presupuestos/application/casos-de-uso";

import { SupabaseNotificacionRepository } from "@/modules/notificaciones/infrastructure/supabase-notificacion.repository";
import {
  EnviarNotificaciones,
  ListarNotificaciones,
  MarcarAvisoLeido,
  MarcarAvisosLeidos,
  ObtenerBandejaAvisos,
  ProgramarAvisos,
} from "@/modules/notificaciones/application/casos-de-uso";
import { ResendNotificador } from "@/shared/infrastructure/email/resend";
import { MetaWhatsAppNotificador } from "@/shared/infrastructure/whatsapp/meta";
import { ExcelJsGenerador } from "@/shared/infrastructure/export/excel";
import { ReactPdfGenerador } from "@/shared/infrastructure/export/pdf";
import { ExportarDatos } from "@/modules/reportes/application/exportar-datos.use-case";
import {
  ExportarReporte,
  ReporteEstadoFinanciero,
  ReporteFlujoCaja,
  ReporteMovimientos,
  ReporteObligaciones,
} from "@/modules/reportes/application/casos-de-uso";
import { SupabaseDashboardRepository } from "@/modules/dashboard/infrastructure/supabase-dashboard.repository";
import { ObtenerPanel } from "@/modules/dashboard/application/obtener-panel.use-case";

import { SupabaseAlmacenamiento } from "@/shared/infrastructure/storage/supabase-almacenamiento";
import { SupabaseDocumentoRepository } from "@/modules/documentos/infrastructure/supabase-documento.repository";
import {
  EliminarDocumento,
  ListarDocumentos,
  ObtenerUrlDocumento,
  SubirDocumento,
} from "@/modules/documentos/application/casos-de-uso";

import { SupabaseObligacionRepository } from "@/modules/obligaciones/infrastructure/supabase-obligacion.repository";
import {
  ActualizarEstadosVencidos,
  ActualizarObligacion,
  CambiarEstadoObligacion,
  CambiarEstadoOcurrencia,
  CrearObligacion,
  EliminarObligacion,
  GenerarOcurrencias,
  ListarAgenda,
  ListarObligaciones,
  ListarOcurrencias,
  PagarOcurrencia,
} from "@/modules/obligaciones/application/casos-de-uso";

import { SupabaseMovimientoRepository } from "@/modules/movimientos/infrastructure/supabase-movimiento.repository";
import { RegistrarMovimiento } from "@/modules/movimientos/application/registrar-movimiento.use-case";
import { ActualizarMovimiento } from "@/modules/movimientos/application/actualizar-movimiento.use-case";
import { MarcarMovimientoPagado } from "@/modules/movimientos/application/marcar-pagado.use-case";
import { AnularMovimiento } from "@/modules/movimientos/application/anular-movimiento.use-case";
import { ListarMovimientos } from "@/modules/movimientos/application/listar-movimientos.use-case";
import { DuplicarMovimiento } from "@/modules/movimientos/application/duplicar-movimiento.use-case";
import {
  ImportarMovimientos,
  PrevisualizarImportacion,
} from "@/modules/movimientos/application/importar-movimientos.use-case";

/**
 * Contenedor de dependencias por request (Contexto.md §7.2, §7.5).
 *
 * Es el unico punto donde se conocen simultaneamente los casos de uso y los
 * adaptadores. Ni las paginas ni las Server Actions instancian repositorios.
 */
export function crearContenedor(zonaHoraria = AJUSTES_POR_OMISION.zonaHoraria) {
  const supabase = crearClienteServidor();
  const reloj = new RelojDelSistema(zonaHoraria);
  const nuevoId = () => randomUUID();

  const ajustes = new SupabaseAjustesRepository(supabase);
  const proyectos = new SupabaseProyectoRepository(supabase);
  const tiposProyecto = new SupabaseTipoProyectoRepository(supabase);
  const categorias = new SupabaseCategoriaRepository(supabase);
  const metodosPago = new SupabaseMetodoPagoRepository(supabase);
  const movimientos = new SupabaseMovimientoRepository(supabase);
  const obligaciones = new SupabaseObligacionRepository(supabase);
  const documentos = new SupabaseDocumentoRepository(supabase);
  const almacenamiento = new SupabaseAlmacenamiento(supabase);
  const panel = new SupabaseDashboardRepository(supabase);
  const pasivos = new SupabasePasivoRepository(supabase);
  const valoraciones = new SupabaseValoracionRepository(supabase);
  const presupuestos = new SupabasePresupuestoRepository(supabase);
  const notificaciones = new SupabaseNotificacionRepository(supabase);
  // §17 P-3: solo se inyecta si Meta esta configurado en el entorno; sin eso,
  // el canal whatsapp se trata como si el adaptador no existiera (§10.2).
  const metaWhatsApp = new MetaWhatsAppNotificador();

  // Se instancia una vez y se comparte: `PagarOcurrencia` reutiliza el mismo caso
  // de uso que el formulario de movimientos, para que las invariantes de §5.7 se
  // apliquen una sola vez y en un solo sitio (RF-54).
  const registrarMovimiento = new RegistrarMovimiento(
    movimientos,
    proyectos,
    categorias,
    reloj,
    nuevoId,
  );
  const listarMovimientos = new ListarMovimientos(movimientos, reloj);
  const previsualizarImportacion = new PrevisualizarImportacion(proyectos, categorias, metodosPago);

  return {
    // El cliente de datos NO se expone: la presentacion invoca casos de uso, no
    // consulta la base (§7.1.4). Vive solo dentro de este ambito para inyectarlo
    // en los adaptadores.
    reloj,

    ajustes: {
      obtener: () => ajustes.obtener(),
      actualizar: new ActualizarAjustes(ajustes),
    },
    metodosPago: {
      listar: new ListarMetodosPago(metodosPago),
      crear: new CrearMetodoPago(metodosPago, nuevoId),
      actualizar: new ActualizarMetodoPago(metodosPago),
      eliminar: new EliminarMetodoPago(metodosPago),
    },

    proyectos: {
      crear: new CrearProyecto(proyectos, tiposProyecto, reloj, nuevoId),
      actualizar: new ActualizarProyecto(proyectos, tiposProyecto),
      cambiarEstado: new CambiarEstadoProyecto(proyectos, reloj),
      eliminar: new EliminarProyecto(proyectos),
      listar: new ListarProyectos(proyectos),
      obtener: new ObtenerProyecto(proyectos),
      resumen: new ObtenerResumenProyecto(proyectos, tiposProyecto, reloj),
      listarTipos: new ListarTiposProyecto(tiposProyecto),
      // RF-100: administracion del catalogo de tipos (§13).
      listarTodosLosTipos: new ListarTodosLosTipos(tiposProyecto),
      crearTipo: new CrearTipoProyecto(tiposProyecto, nuevoId),
      actualizarTipo: new ActualizarTipoProyecto(tiposProyecto),
      cambiarEstadoTipo: new CambiarEstadoTipoProyecto(tiposProyecto),
      eliminarTipo: new EliminarTipoProyecto(tiposProyecto),
    },

    categorias: {
      listar: new ListarCategorias(categorias),
      crear: new CrearCategoria(categorias, nuevoId),
      actualizar: new ActualizarCategoria(categorias),
      cambiarEstado: new CambiarEstadoCategoria(categorias),
      eliminar: new EliminarCategoria(categorias),
    },

    movimientos: {
      registrar: registrarMovimiento,
      actualizar: new ActualizarMovimiento(movimientos, categorias),
      marcarPagado: new MarcarMovimientoPagado(movimientos, metodosPago, reloj),
      anular: new AnularMovimiento(movimientos),
      duplicar: new DuplicarMovimiento(movimientos, reloj, nuevoId),
      // RF-27: la importacion reutiliza `registrar`, para que el CSV no pueda
      // saltarse las invariantes de §5.7.
      previsualizarImportacion: previsualizarImportacion,
      importar: new ImportarMovimientos(previsualizarImportacion, registrarMovimiento),
      listar: listarMovimientos,
    },

    obligaciones: {
      listar: new ListarObligaciones(obligaciones),
      listarAgenda: new ListarAgenda(obligaciones),
      listarOcurrencias: new ListarOcurrencias(obligaciones),
      crear: new CrearObligacion(obligaciones, proyectos, categorias, nuevoId),
      actualizar: new ActualizarObligacion(obligaciones, categorias),
      cambiarEstado: new CambiarEstadoObligacion(obligaciones),
      eliminar: new EliminarObligacion(obligaciones),
      generarOcurrencias: new GenerarOcurrencias(obligaciones),
      actualizarEstadosVencidos: new ActualizarEstadosVencidos(obligaciones),
      pagarOcurrencia: new PagarOcurrencia(obligaciones, categorias, registrarMovimiento, reloj),
      cambiarEstadoOcurrencia: new CambiarEstadoOcurrencia(obligaciones),
    },

    dashboard: {
      panel: new ObtenerPanel(panel, proyectos, obligaciones, reloj),
      // §5.5: el semáforo de todos los proyectos con tres lecturas agregadas.
      semaforos: new ObtenerSemaforos(panel, obligaciones, presupuestos, tiposProyecto, reloj),
    },

    calendario: {
      obtener: new ObtenerCalendario(listarMovimientos, obligaciones, reloj),
    },

    reportes: {
      // Un armador por tipo de reporte (RF-90 a RF-93) y un solo exportador
      // (RF-94, RF-95): agregar un reporte no toca la infraestructura (§11).
      movimientos: new ReporteMovimientos(listarMovimientos, reloj),
      flujo: new ReporteFlujoCaja(panel, reloj),
      obligaciones: new ReporteObligaciones(obligaciones, reloj),
      estado: new ReporteEstadoFinanciero(proyectos, reloj),
      exportar: new ExportarReporte(new ExcelJsGenerador(), new ReactPdfGenerador(), reloj),
      // RF-103: los datos son del dueño; esta es la puerta de salida.
      exportarDatos: new ExportarDatos({
        ajustes: () => ajustes.obtener(),
        tipos: tiposProyecto,
        proyectos,
        categorias,
        metodosPago,
        movimientos: listarMovimientos,
        obligaciones,
        documentos,
        pasivos,
        valoraciones,
        presupuestos,
        reloj,
      }),
    },

    patrimonio: {
      // RF-16, RF-17, RF-78.
      listarPasivos: new ListarPasivos(pasivos),
      registrarPasivo: new RegistrarPasivo(pasivos, proyectos, nuevoId),
      actualizarPasivo: new ActualizarPasivo(pasivos),
      abonarACapital: new AbonarACapital(pasivos),
      cambiarEstadoPasivo: new CambiarEstadoPasivo(pasivos),
      eliminarPasivo: new EliminarPasivo(pasivos),
      listarValoraciones: new ListarValoraciones(valoraciones),
      registrarValoracion: new RegistrarValoracion(valoraciones, proyectos, nuevoId),
      eliminarValoracion: new EliminarValoracion(valoraciones),
      obtener: new ObtenerPatrimonio(valoraciones),
    },

    presupuestos: {
      // RF-80 a RF-83.
      listarEjecucion: new ListarEjecucionPresupuestos(presupuestos),
      crear: new CrearPresupuesto(presupuestos, categorias, nuevoId),
      actualizar: new ActualizarPresupuesto(presupuestos),
      eliminar: new EliminarPresupuesto(presupuestos),
      copiar: new CopiarPresupuestos(presupuestos, nuevoId),
    },

    notificaciones: {
      // §10, RF-53, RF-102.
      listar: new ListarNotificaciones(notificaciones),
      programar: new ProgramarAvisos(notificaciones, obligaciones, reloj, nuevoId),
      enviar: new EnviarNotificaciones(
        notificaciones,
        new ResendNotificador(),
        reloj,
        metaWhatsApp.disponible() ? metaWhatsApp : undefined,
      ),
      // RF-59: el lado que lee. La bandeja necesita el reloj porque «publicado»
      // es una comparación contra ahora, no un estado guardado (§10.2).
      bandeja: new ObtenerBandejaAvisos(notificaciones, reloj),
      marcarLeido: new MarcarAvisoLeido(notificaciones, reloj),
      marcarTodosLeidos: new MarcarAvisosLeidos(notificaciones, reloj),
    },

    documentos: {
      listar: new ListarDocumentos(documentos),
      subir: new SubirDocumento(documentos, proyectos, almacenamiento, reloj, nuevoId),
      url: new ObtenerUrlDocumento(documentos, almacenamiento),
      eliminar: new EliminarDocumento(documentos, almacenamiento, reloj),
    },
  };
}

export type Contenedor = ReturnType<typeof crearContenedor>;

/**
 * Casos de uso del acceso. Se separan del contenedor principal porque son los
 * unicos que se usan SIN sesion: son la puerta, no lo que hay detras (§9).
 */
export async function contenedorDeAcceso() {
  const credencial = credencialDelEntorno();
  const almacen = await crearAlmacenSesion();
  const reloj = new RelojDelSistema();

  return {
    iniciar: new IniciarSesion(credencial, almacen, controlDeIntentos(), reloj),
    cerrar: new CerrarSesion(almacen),
    verificar: new VerificarSesion(credencial, almacen, reloj),
  };
}

/**
 * Contenedor de toda operacion privada: exige sesion vigente y ajusta el reloj a
 * la zona horaria configurada para que las fechas de negocio sean correctas
 * (§8.5).
 *
 * La sesion se comprueba aqui ADEMAS del middleware, y no es redundante: el
 * middleware protege navegaciones, esto protege Server Actions, que se invocan
 * por POST y no siempre pasan por el matcher (§9).
 */
export async function contenedorPrivado(): Promise<{
  contenedor: Contenedor;
  ajustes: Ajustes;
}> {
  const acceso = await contenedorDeAcceso();
  await acceso.verificar.exigirSesion();

  const base = crearContenedor();
  const ajustes = await base.ajustes.obtener();

  const contenedor =
    ajustes.zonaHoraria === AJUSTES_POR_OMISION.zonaHoraria
      ? base
      : crearContenedor(ajustes.zonaHoraria);

  return { contenedor, ajustes };
}
