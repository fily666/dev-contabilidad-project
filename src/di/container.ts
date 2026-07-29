import { randomUUID } from "node:crypto";

import { NoAutorizado } from "@/shared/domain/errores";
import { RelojDelSistema } from "@/shared/infrastructure/reloj-del-sistema";
import { crearClienteServidor } from "@/shared/infrastructure/supabase/cliente-servidor";
import { urlAplicacion } from "@/shared/infrastructure/supabase/entorno";

import {
  SupabaseAutenticacionService,
  SupabasePerfilRepository,
} from "@/modules/auth/infrastructure/supabase-autenticacion.service";
import type { Sesion } from "@/modules/auth/domain/sesion";

import { SupabaseCategoriaRepository } from "@/modules/categorias/infrastructure/supabase-categoria.repository";
import {
  ActualizarCategoria,
  CambiarEstadoCategoria,
  CrearCategoria,
  EliminarCategoria,
  ListarCategorias,
} from "@/modules/categorias/application/casos-de-uso";

import { SupabaseMetodoPagoRepository } from "@/modules/metodos-pago/infrastructure/supabase-metodo-pago.repository";

import { SupabaseProyectoRepository } from "@/modules/proyectos/infrastructure/supabase-proyecto.repository";
import { SupabaseTipoProyectoRepository } from "@/modules/proyectos/infrastructure/supabase-tipo-proyecto.repository";
import { CrearProyecto } from "@/modules/proyectos/application/crear-proyecto.use-case";
import { ActualizarProyecto } from "@/modules/proyectos/application/actualizar-proyecto.use-case";
import { CambiarEstadoProyecto } from "@/modules/proyectos/application/cambiar-estado-proyecto.use-case";
import { EliminarProyecto } from "@/modules/proyectos/application/eliminar-proyecto.use-case";
import { ListarProyectos } from "@/modules/proyectos/application/listar-proyectos.use-case";
import { ListarTiposProyecto } from "@/modules/proyectos/application/listar-tipos-proyecto.use-case";
import { ObtenerResumenProyecto } from "@/modules/proyectos/application/obtener-resumen-proyecto.use-case";

import { SupabaseMovimientoRepository } from "@/modules/movimientos/infrastructure/supabase-movimiento.repository";
import { RegistrarMovimiento } from "@/modules/movimientos/application/registrar-movimiento.use-case";
import { ActualizarMovimiento } from "@/modules/movimientos/application/actualizar-movimiento.use-case";
import { MarcarMovimientoPagado } from "@/modules/movimientos/application/marcar-pagado.use-case";
import { AnularMovimiento } from "@/modules/movimientos/application/anular-movimiento.use-case";
import { ListarMovimientos } from "@/modules/movimientos/application/listar-movimientos.use-case";

/**
 * Contenedor de dependencias por request (Contexto.md §7.2, §7.5).
 *
 * Es el unico punto donde se conocen simultaneamente los casos de uso y los
 * adaptadores. Ni las paginas ni las Server Actions instancian repositorios.
 */
export async function crearContenedor(zonaHoraria = "America/Bogota") {
  const supabase = await crearClienteServidor();
  const reloj = new RelojDelSistema(zonaHoraria);
  const nuevoId = () => randomUUID();

  const perfiles = new SupabasePerfilRepository(supabase);
  const autenticacion = new SupabaseAutenticacionService(supabase, urlAplicacion());

  const proyectos = new SupabaseProyectoRepository(supabase);
  const tiposProyecto = new SupabaseTipoProyectoRepository(supabase);
  const categorias = new SupabaseCategoriaRepository(supabase);
  const metodosPago = new SupabaseMetodoPagoRepository(supabase);
  const movimientos = new SupabaseMovimientoRepository(supabase);

  return {
    supabase,
    reloj,

    autenticacion,
    perfiles,
    // Repositorios expuestos para lecturas simples de catalogos.
    metodosPago,

    proyectos: {
      crear: new CrearProyecto(proyectos, tiposProyecto, reloj, nuevoId),
      actualizar: new ActualizarProyecto(proyectos, tiposProyecto),
      cambiarEstado: new CambiarEstadoProyecto(proyectos, reloj),
      eliminar: new EliminarProyecto(proyectos),
      listar: new ListarProyectos(proyectos),
      resumen: new ObtenerResumenProyecto(proyectos, tiposProyecto, reloj),
      listarTipos: new ListarTiposProyecto(tiposProyecto),
      repositorio: proyectos,
    },

    categorias: {
      listar: new ListarCategorias(categorias),
      crear: new CrearCategoria(categorias, nuevoId),
      actualizar: new ActualizarCategoria(categorias),
      cambiarEstado: new CambiarEstadoCategoria(categorias),
      eliminar: new EliminarCategoria(categorias),
      repositorio: categorias,
    },

    movimientos: {
      registrar: new RegistrarMovimiento(movimientos, proyectos, categorias, reloj, nuevoId),
      actualizar: new ActualizarMovimiento(movimientos, categorias),
      marcarPagado: new MarcarMovimientoPagado(movimientos, metodosPago, reloj),
      anular: new AnularMovimiento(movimientos),
      listar: new ListarMovimientos(movimientos),
      repositorio: movimientos,
    },
  };
}

export type Contenedor = Awaited<ReturnType<typeof crearContenedor>>;

/**
 * Contenedor con la sesion ya resuelta. Toda operacion privada parte de aqui:
 * la autorizacion se verifica en la aplicacion ademas de RLS (§9).
 */
export async function contenedorAutenticado(): Promise<{
  contenedor: Contenedor;
  sesion: Sesion;
}> {
  const base = await crearContenedor();
  const sesion = await base.autenticacion.sesionActual();
  if (!sesion) throw new NoAutorizado("Tu sesión expiró. Inicia sesión de nuevo.");

  // Se reconstruye el contenedor con la zona horaria del perfil para que las
  // fechas de negocio sean correctas (§8.5).
  const contenedor =
    sesion.perfil.zonaHoraria === "America/Bogota"
      ? base
      : await crearContenedor(sesion.perfil.zonaHoraria);

  return { contenedor, sesion };
}
