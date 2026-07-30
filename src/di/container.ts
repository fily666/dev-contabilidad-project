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
import { ObtenerProyecto } from "@/modules/proyectos/application/obtener-proyecto.use-case";
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
    },

    categorias: {
      listar: new ListarCategorias(categorias),
      crear: new CrearCategoria(categorias, nuevoId),
      actualizar: new ActualizarCategoria(categorias),
      cambiarEstado: new CambiarEstadoCategoria(categorias),
      eliminar: new EliminarCategoria(categorias),
    },

    movimientos: {
      registrar: new RegistrarMovimiento(movimientos, proyectos, categorias, reloj, nuevoId),
      actualizar: new ActualizarMovimiento(movimientos, categorias),
      marcarPagado: new MarcarMovimientoPagado(movimientos, metodosPago, reloj),
      anular: new AnularMovimiento(movimientos),
      listar: new ListarMovimientos(movimientos),
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
