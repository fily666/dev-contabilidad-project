import { describe, expect, it } from "vitest";
import { RelojFijo } from "@/shared/testing/reloj-fijo";

import { ActualizarProyecto } from "./actualizar-proyecto.use-case";
import { CambiarEstadoProyecto } from "./cambiar-estado-proyecto.use-case";
import { CrearProyecto } from "./crear-proyecto.use-case";
import { EliminarProyecto } from "./eliminar-proyecto.use-case";
import { ListarProyectos } from "./listar-proyectos.use-case";
import { ListarTiposProyecto } from "./listar-tipos-proyecto.use-case";
import { ObtenerProyecto } from "./obtener-proyecto.use-case";
import { ObtenerResumenProyecto } from "./obtener-resumen-proyecto.use-case";
import {
  ActualizarTipoProyecto,
  CambiarEstadoTipoProyecto,
  CrearTipoProyecto,
  EliminarTipoProyecto,
  ListarTodosLosTipos,
} from "./administrar-tipos-proyecto.use-case";
import {
  ProyectoRepositoryEnMemoria,
  TIPO_INMUEBLE,
  TIPO_VEHICULO,
  TipoProyectoRepositoryEnMemoria,
  proyectoDePrueba,
} from "./dobles";

/** Contexto.md §8.8: todos los casos de uso, con repositorios en memoria. */

function montar() {
  const proyectos = new ProyectoRepositoryEnMemoria();
  const tipos = new TipoProyectoRepositoryEnMemoria();
  const reloj = new RelojFijo("2026-07-30");
  let contador = 0;
  const nuevoId = () => `00000000-0000-4000-8000-00000000000${++contador}`;

  return {
    proyectos,
    tipos,
    reloj,
    crear: new CrearProyecto(proyectos, tipos, reloj, nuevoId),
    actualizar: new ActualizarProyecto(proyectos, tipos),
    cambiarEstado: new CambiarEstadoProyecto(proyectos, reloj),
    eliminar: new EliminarProyecto(proyectos),
    listar: new ListarProyectos(proyectos),
    obtener: new ObtenerProyecto(proyectos),
    resumen: new ObtenerResumenProyecto(proyectos, tipos, reloj),
    listarTipos: new ListarTiposProyecto(tipos),
    listarTodosLosTipos: new ListarTodosLosTipos(tipos),
    crearTipo: new CrearTipoProyecto(tipos, nuevoId),
    actualizarTipo: new ActualizarTipoProyecto(tipos),
    cambiarEstadoTipo: new CambiarEstadoTipoProyecto(tipos),
    eliminarTipo: new EliminarTipoProyecto(tipos),
  };
}

describe("CrearProyecto", () => {
  it("crea el proyecto con la fecha de negocio de hoy si no se indica (§8.5)", async () => {
    const { crear, proyectos } = montar();

    const proyecto = await crear.ejecutar({
      tipoProyectoId: TIPO_INMUEBLE.id,
      nombre: "Apartamento 302",
      atributos: { direccion: "Calle 100 # 15-20" },
    });

    expect(proyecto.fechaInicio).toBe("2026-07-30");
    expect(proyecto.estado).toBe("activo");
    expect(proyecto.moneda).toBe("COP");
    expect(proyectos.filas.get(proyecto.id)).toBeDefined();
  });

  it("guarda solo los atributos declarados por el tipo (RF-14, ADR-07)", async () => {
    const { crear } = montar();

    const proyecto = await crear.ejecutar({
      tipoProyectoId: TIPO_VEHICULO.id,
      nombre: "Moto",
      atributos: { placa: "ABC12D", cilindraje: "250 cc", inventado: "no debe quedar" },
    });

    expect(proyecto.atributos).toEqual({ placa: "ABC12D", cilindraje: 250 });
  });

  it("rechaza un tipo de proyecto inexistente", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({ tipoProyectoId: "99999999-9999-4999-8999-999999999999", nombre: "X" }),
    ).rejects.toMatchObject({ codigo: "TIPO_PROYECTO_NO_ENCONTRADO" });
  });

  it("exige los atributos obligatorios del tipo", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({ tipoProyectoId: TIPO_INMUEBLE.id, nombre: "Sin dirección" }),
    ).rejects.toMatchObject({ codigo: "ATRIBUTO_REQUERIDO" });
  });
});

describe("ActualizarProyecto", () => {
  it("actualiza nombre, fechas y atributos", async () => {
    const { actualizar, proyectos } = montar();
    const proyecto = proyectoDePrueba();
    await proyectos.guardar(proyecto);

    const actualizado = await actualizar.ejecutar({
      id: proyecto.id,
      tipoProyectoId: TIPO_INMUEBLE.id,
      nombre: "Apartamento renombrado",
      fechaInicio: "2026-02-01",
      atributos: { direccion: "Nueva dirección" },
    });

    expect(actualizado.nombre).toBe("Apartamento renombrado");
    expect(actualizado.fechaInicio).toBe("2026-02-01");
    expect(actualizado.atributos.direccion).toBe("Nueva dirección");
  });

  it("falla si el proyecto no existe", async () => {
    const { actualizar } = montar();

    await expect(
      actualizar.ejecutar({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        tipoProyectoId: TIPO_INMUEBLE.id,
        nombre: "X",
        fechaInicio: "2026-01-01",
      }),
    ).rejects.toMatchObject({ codigo: "PROYECTO_NO_ENCONTRADO" });
  });

  it("rechaza una fecha de cierre anterior al inicio", async () => {
    const { actualizar, proyectos } = montar();
    const proyecto = proyectoDePrueba();
    await proyectos.guardar(proyecto);

    await expect(
      actualizar.ejecutar({
        id: proyecto.id,
        tipoProyectoId: TIPO_INMUEBLE.id,
        nombre: "Apartamento",
        fechaInicio: "2026-05-01",
        fechaFin: "2026-04-01",
        atributos: { direccion: "Calle 1" },
      }),
    ).rejects.toMatchObject({ codigo: "FECHAS_INCOHERENTES" });
  });
});

describe("CambiarEstadoProyecto", () => {
  it("al finalizar fija la fecha de cierre con la fecha de negocio de hoy", async () => {
    const { cambiarEstado, proyectos } = montar();
    const proyecto = proyectoDePrueba();
    await proyectos.guardar(proyecto);

    const finalizado = await cambiarEstado.ejecutar({ id: proyecto.id, estado: "finalizado" });

    expect(finalizado.estado).toBe("finalizado");
    expect(finalizado.fechaFin).toBe("2026-07-30");
    expect(finalizado.aceptaMovimientos()).toBe(false);
  });

  it("al reactivar un proyecto finalizado limpia la fecha de cierre", async () => {
    const { cambiarEstado, proyectos } = montar();
    const proyecto = proyectoDePrueba();
    await proyectos.guardar(proyecto);
    await cambiarEstado.ejecutar({ id: proyecto.id, estado: "finalizado" });

    const reactivado = await cambiarEstado.ejecutar({ id: proyecto.id, estado: "activo" });

    expect(reactivado.fechaFin).toBeNull();
    expect(reactivado.aceptaMovimientos()).toBe(true);
  });
});

describe("EliminarProyecto (RF-18)", () => {
  it("elimina un proyecto sin movimientos", async () => {
    const { eliminar, proyectos } = montar();
    const proyecto = proyectoDePrueba();
    await proyectos.guardar(proyecto);

    await eliminar.ejecutar({ id: proyecto.id });

    expect(proyectos.eliminados).toEqual([proyecto.id]);
  });

  it("se niega a eliminar un proyecto con movimientos: solo archivar", async () => {
    const { eliminar, proyectos } = montar();
    const proyecto = proyectoDePrueba();
    await proyectos.guardar(proyecto);
    proyectos.movimientosPorProyecto.set(proyecto.id, 3);

    await expect(eliminar.ejecutar({ id: proyecto.id })).rejects.toMatchObject({
      codigo: "PROYECTO_CON_MOVIMIENTOS",
    });
    expect(proyectos.eliminados).toEqual([]);
  });
});

describe("Consultas", () => {
  it("ListarProyectos filtra por estado", async () => {
    const { listar, proyectos, cambiarEstado } = montar();
    const activo = proyectoDePrueba({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" });
    const archivado = proyectoDePrueba({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2" });
    await proyectos.guardar(activo);
    await proyectos.guardar(archivado);
    await cambiarEstado.ejecutar({ id: archivado.id, estado: "archivado" });

    const soloActivos = await listar.ejecutar({ filtro: { estados: ["activo"] } });

    expect(soloActivos.map((p) => p.proyectoId)).toEqual([activo.id]);
  });

  it("ObtenerProyecto lanza si no existe y `buscar` devuelve null", async () => {
    const { obtener } = montar();

    await expect(
      obtener.ejecutar({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    ).rejects.toMatchObject({ codigo: "PROYECTO_NO_ENCONTRADO" });
    await expect(
      obtener.buscar({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    ).resolves.toBeNull();
  });

  it("ObtenerResumenProyecto calcula los indicadores de §5 sobre las cifras del puerto", async () => {
    const { resumen, proyectos } = montar();
    const proyecto = proyectoDePrueba({ fechaInicio: "2025-07-30" });
    await proyectos.guardar(proyecto);
    proyectos.cifras.set(proyecto.id, {
      totalInvertido: 100_000_000,
      totalGastosOperativos: 4_000_000,
      totalIngresos: 24_000_000,
      ingresos12m: 24_000_000,
      gastosOperativos12m: 4_000_000,
    });

    const { indicadores, indicadoresVisibles } = await resumen.ejecutar({
      proyectoId: proyecto.id,
    });

    expect(indicadores.totalEgresos).toBe(104_000_000);
    expect(indicadores.balance).toBe(-80_000_000);
    expect(indicadores.yieldBruto).toBeCloseTo(0.24, 6);
    expect(indicadores.yieldNeto).toBeCloseTo(0.2, 6);
    // Sin valoracion registrada, los indicadores de patrimonio son null (§5.3).
    expect(indicadores.plusvalia).toBeNull();
    expect(indicadores.esEstimado).toBe(false);
    expect(indicadoresVisibles).toContain("roi_acumulado");
  });

  it("ListarTiposProyecto devuelve el catalogo del sistema", async () => {
    const { listarTipos } = montar();

    const tipos = await listarTipos.ejecutar();

    expect(tipos.map((t) => t.codigo)).toEqual(["inmueble", "vehiculo"]);
  });
});

describe("Administrar tipos de proyecto (RF-100, §13)", () => {
  const CONFIGURACION = {
    atributos: [
      {
        clave: "area_lote",
        etiqueta: "Área del lote (m²)",
        tipo: "number" as const,
        requerido: true,
      },
    ],
    indicadores: ["total_invertido", "tco"],
    generaIngresos: false,
    seValoriza: true,
  };

  it("crea un tipo propio con su codigo normalizado y sin ser del sistema", async () => {
    const { crearTipo } = montar();

    const tipo = await crearTipo.ejecutar({
      codigo: "Construcción de Vivienda",
      nombre: "Construcción de vivienda",
      configuracion: CONFIGURACION,
    });

    expect(tipo.codigo).toBe("construccion_de_vivienda");
    expect(tipo.esSistema).toBe(false);
    expect(tipo.activo).toBe(true);
  });

  it("un tipo nuevo sirve de inmediato para crear proyectos, sin migracion (RNF-10)", async () => {
    const { crearTipo, crear } = montar();
    const tipo = await crearTipo.ejecutar({
      codigo: "construccion",
      nombre: "Construcción",
      configuracion: CONFIGURACION,
    });

    const proyecto = await crear.ejecutar({
      tipoProyectoId: tipo.id,
      nombre: "Casa del lote 7",
      atributos: { area_lote: "320" },
    });

    expect(proyecto.atributos).toEqual({ area_lote: 320 });
  });

  it("rechaza codigos duplicados", async () => {
    const { crearTipo } = montar();

    await expect(
      crearTipo.ejecutar({
        codigo: "inmueble",
        nombre: "Otro inmueble",
        configuracion: CONFIGURACION,
      }),
    ).rejects.toMatchObject({ codigo: "TIPO_PROYECTO_DUPLICADO" });
  });

  it("rechaza claves de atributo invalidas y duplicadas", async () => {
    const { crearTipo } = montar();

    await expect(
      crearTipo.ejecutar({
        codigo: "malo1",
        nombre: "Malo",
        configuracion: {
          ...CONFIGURACION,
          atributos: [
            { clave: "Área Lote", etiqueta: "Área", tipo: "text" as const, requerido: false },
          ],
        },
      }),
    ).rejects.toMatchObject({ codigo: "CLAVE_ATRIBUTO_INVALIDA" });

    await expect(
      crearTipo.ejecutar({
        codigo: "malo2",
        nombre: "Malo",
        configuracion: {
          ...CONFIGURACION,
          atributos: [
            { clave: "area", etiqueta: "Área", tipo: "text" as const, requerido: false },
            { clave: "area", etiqueta: "Área otra vez", tipo: "text" as const, requerido: false },
          ],
        },
      }),
    ).rejects.toMatchObject({ codigo: "ATRIBUTO_DUPLICADO" });
  });

  it("los tipos del sistema se ocultan pero no se editan ni se eliminan (RF-34)", async () => {
    const { actualizarTipo, cambiarEstadoTipo, eliminarTipo, listarTipos } = montar();

    await expect(
      actualizarTipo.ejecutar({
        id: TIPO_INMUEBLE.id,
        nombre: "Renombrado",
        configuracion: CONFIGURACION,
      }),
    ).rejects.toMatchObject({ codigo: "TIPO_PROYECTO_DEL_SISTEMA" });

    await expect(eliminarTipo.ejecutar({ id: TIPO_INMUEBLE.id })).rejects.toMatchObject({
      codigo: "TIPO_PROYECTO_DEL_SISTEMA",
    });

    const oculto = await cambiarEstadoTipo.ejecutar({ id: TIPO_VEHICULO.id, activo: false });
    expect(oculto.activo).toBe(false);
    expect((await listarTipos.ejecutar()).map((t) => t.id)).not.toContain(TIPO_VEHICULO.id);

    // Se deja como estaba: la instancia del catalogo se comparte entre pruebas.
    await cambiarEstadoTipo.ejecutar({ id: TIPO_VEHICULO.id, activo: true });
  });

  it("un tipo propio en uso se oculta, no se elimina", async () => {
    const { crearTipo, eliminarTipo, tipos } = montar();
    const tipo = await crearTipo.ejecutar({
      codigo: "inversion_cripto",
      nombre: "Inversión en cripto",
      configuracion: CONFIGURACION,
    });
    tipos.proyectosPorTipo.set(tipo.id, 2);

    await expect(eliminarTipo.ejecutar({ id: tipo.id })).rejects.toMatchObject({
      codigo: "TIPO_PROYECTO_EN_USO",
    });

    tipos.proyectosPorTipo.set(tipo.id, 0);
    await eliminarTipo.ejecutar({ id: tipo.id });
    expect(tipos.eliminados).toContain(tipo.id);
  });

  it("listarTodosLosTipos incluye los ocultos", async () => {
    const { cambiarEstadoTipo, listarTodosLosTipos, listarTipos } = montar();
    await cambiarEstadoTipo.ejecutar({ id: TIPO_VEHICULO.id, activo: false });

    expect((await listarTodosLosTipos.ejecutar()).map((t) => t.id)).toContain(TIPO_VEHICULO.id);
    expect((await listarTipos.ejecutar()).map((t) => t.id)).not.toContain(TIPO_VEHICULO.id);

    await cambiarEstadoTipo.ejecutar({ id: TIPO_VEHICULO.id, activo: true });
  });
});
