import { NoEncontrado, ReglaDeNegocioViolada } from "@/shared/domain/errores";
import { TipoProyecto, type ConfiguracionTipoProyecto } from "../domain/tipo-proyecto.entity";
import type { TipoProyectoRepository } from "../domain/tipo-proyecto.repository";

/**
 * RF-100: administrar tipos de proyecto propios.
 *
 * Es el mecanismo de extensibilidad de §13 puesto en la interfaz: un tipo nuevo
 * con sus atributos y sus indicadores, sin migracion y sin tocar la logica.
 */

export type EntradaTipoProyecto = {
  nombre: string;
  icono?: string | null;
  configuracion: ConfiguracionTipoProyecto;
};

export class ListarTodosLosTipos {
  constructor(private readonly tipos: TipoProyectoRepository) {}

  /** Incluye los ocultos: la pantalla de configuracion debe poder reactivarlos. */
  async ejecutar(): Promise<TipoProyecto[]> {
    return this.tipos.listarTodos();
  }
}

export class CrearTipoProyecto {
  constructor(
    private readonly tipos: TipoProyectoRepository,
    private readonly nuevoId: () => string,
  ) {}

  async ejecutar(entrada: EntradaTipoProyecto & { codigo: string }): Promise<TipoProyecto> {
    const tipo = TipoProyecto.crear({
      id: this.nuevoId(),
      codigo: entrada.codigo,
      nombre: entrada.nombre,
      icono: entrada.icono,
      configuracion: entrada.configuracion,
    });

    // El codigo es unico en la tabla (§6.3); se comprueba antes para dar un
    // mensaje del dominio en lugar de un error de restriccion.
    if (await this.tipos.buscarPorCodigo(tipo.codigo)) {
      throw new ReglaDeNegocioViolada(
        "TIPO_PROYECTO_DUPLICADO",
        `Ya existe un tipo de proyecto con el codigo «${tipo.codigo}».`,
        "codigo",
      );
    }

    return this.tipos.guardar(tipo);
  }
}

export class ActualizarTipoProyecto {
  constructor(private readonly tipos: TipoProyectoRepository) {}

  async ejecutar(entrada: EntradaTipoProyecto & { id: string }): Promise<TipoProyecto> {
    const tipo = await this.tipos.buscarPorId(entrada.id);
    if (!tipo) throw new NoEncontrado("tipo de proyecto", entrada.id);

    tipo.actualizar({
      nombre: entrada.nombre,
      icono: entrada.icono,
      configuracion: entrada.configuracion,
    });

    return this.tipos.actualizar(tipo);
  }
}

/** Ocultar o reactivar. Aplica tambien a los del sistema (RF-34). */
export class CambiarEstadoTipoProyecto {
  constructor(private readonly tipos: TipoProyectoRepository) {}

  async ejecutar(entrada: { id: string; activo: boolean }): Promise<TipoProyecto> {
    const tipo = await this.tipos.buscarPorId(entrada.id);
    if (!tipo) throw new NoEncontrado("tipo de proyecto", entrada.id);

    if (entrada.activo) tipo.activar();
    else tipo.desactivar();

    return this.tipos.actualizar(tipo);
  }
}

/** Un tipo con proyectos se oculta, no se elimina (misma regla que RF-18). */
export class EliminarTipoProyecto {
  constructor(private readonly tipos: TipoProyectoRepository) {}

  async ejecutar(entrada: { id: string }): Promise<void> {
    const tipo = await this.tipos.buscarPorId(entrada.id);
    if (!tipo) throw new NoEncontrado("tipo de proyecto", entrada.id);

    if (tipo.esSistema) {
      throw new ReglaDeNegocioViolada(
        "TIPO_PROYECTO_DEL_SISTEMA",
        "Los tipos de proyecto del sistema no se pueden eliminar; puedes ocultarlos.",
      );
    }

    const enUso = await this.tipos.contarProyectos(entrada.id);
    if (enUso > 0) {
      throw new ReglaDeNegocioViolada(
        "TIPO_PROYECTO_EN_USO",
        `El tipo tiene ${enUso} proyecto(s) asociado(s): ocultalo en lugar de eliminarlo.`,
      );
    }

    await this.tipos.eliminar(entrada.id);
  }
}
