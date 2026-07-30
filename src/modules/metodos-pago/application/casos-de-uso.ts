import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import type { TipoMetodoPago } from "@/shared/domain/enumeraciones";

import { MetodoPago } from "../domain/metodo-pago.entity";
import type { MetodoPagoRepository, MetodoPagoVista } from "../domain/metodo-pago.repository";

/**
 * Casos de uso del catalogo de metodos de pago (Contexto.md RF-33).
 *
 * Existen porque la presentacion solo invoca casos de uso (§7.1.4): antes las
 * Server Actions hablaban con el repositorio y la regla de «no eliminar un
 * metodo en uso» vivia en la accion, justo donde §7.4 dice que no debe estar.
 */

/** RF-33: catalogo para el selector de movimientos y para configuracion. */
export class ListarMetodosPago {
  constructor(private readonly metodosPago: MetodoPagoRepository) {}

  async ejecutar(entrada: { soloActivos?: boolean } = {}): Promise<MetodoPagoVista[]> {
    return this.metodosPago.listar(entrada.soloActivos ?? true);
  }
}

/** RF-33. */
export class CrearMetodoPago {
  constructor(
    private readonly metodosPago: MetodoPagoRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: {
    nombre: string;
    tipo: TipoMetodoPago;
    ultimosDigitos?: string | null;
  }): Promise<MetodoPagoVista> {
    const metodo = MetodoPago.crear({ id: this.nuevoId(), ...entrada });

    // El nombre es unico en la tabla (§6.3); se comprueba antes para dar un
    // mensaje del dominio en lugar de un error de restriccion.
    if (await this.metodosPago.existeNombre(metodo.nombre)) {
      throw new ReglaDeNegocioViolada(
        "METODO_PAGO_DUPLICADO",
        "Ya existe un metodo de pago con ese nombre.",
        "nombre",
      );
    }

    return this.metodosPago.guardar(metodo);
  }
}

/** RF-33: renombrar, cambiar tipo y activar u ocultar. */
export class ActualizarMetodoPago {
  constructor(private readonly metodosPago: MetodoPagoRepository) {}

  async ejecutar(entrada: {
    id: string;
    nombre: string;
    tipo: TipoMetodoPago;
    ultimosDigitos?: string | null;
    activo?: boolean;
  }): Promise<MetodoPagoVista> {
    const metodo = await this.metodosPago.buscarPorId(entrada.id);
    if (!metodo) throw new NoEncontrado("metodo de pago", entrada.id);

    metodo.renombrar(entrada.nombre);
    metodo.cambiarTipo(entrada.tipo);
    metodo.cambiarUltimosDigitos(entrada.ultimosDigitos);

    if (entrada.activo !== undefined) {
      if (entrada.activo) metodo.activar();
      else metodo.desactivar();
    }

    if (await this.metodosPago.existeNombre(metodo.nombre, metodo.id)) {
      throw new ReglaDeNegocioViolada(
        "METODO_PAGO_DUPLICADO",
        "Ya existe un metodo de pago con ese nombre.",
        "nombre",
      );
    }

    return this.metodosPago.actualizar(metodo);
  }
}

/** RF-33: un metodo con movimientos asociados se desactiva, no se elimina. */
export class EliminarMetodoPago {
  constructor(private readonly metodosPago: MetodoPagoRepository) {}

  async ejecutar(entrada: { id: string }): Promise<void> {
    const metodo = await this.metodosPago.buscarPorId(entrada.id);
    if (!metodo) throw new NoEncontrado("metodo de pago", entrada.id);

    const enUso = await this.metodosPago.contarMovimientos(entrada.id);
    if (enUso > 0) {
      throw new ReglaDeNegocioViolada(
        "METODO_PAGO_EN_USO",
        `El metodo de pago tiene ${enUso} movimiento(s) asociado(s): desactivalo en lugar de eliminarlo.`,
      );
    }

    await this.metodosPago.eliminar(entrada.id);
  }
}
