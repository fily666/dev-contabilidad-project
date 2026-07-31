import { describe, expect, it } from "vitest";
import {
  CategoriaRepositoryEnMemoria,
  categoriaDePrueba,
} from "@/modules/categorias/application/dobles";

import { nivelDeAlerta, resumirEjecucion } from "../domain/alertas";
import { periodoAnual, periodoMensual, periodoSiguiente } from "../domain/presupuesto.entity";
import {
  ActualizarPresupuesto,
  CopiarPresupuestos,
  CrearPresupuesto,
  EliminarPresupuesto,
  ListarEjecucionPresupuestos,
} from "./casos-de-uso";
import { PresupuestoRepositoryEnMemoria } from "./dobles";

/** Contexto.md §8.8: presupuestos (RF-80 a RF-83). */

const MANTENIMIENTO = "cccccccc-cccc-4ccc-8ccc-cccccccccc10";
const CANON = "cccccccc-cccc-4ccc-8ccc-cccccccccc11";
const PROYECTO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function montar() {
  const presupuestos = new PresupuestoRepositoryEnMemoria();
  const categorias = new CategoriaRepositoryEnMemoria([
    categoriaDePrueba({ id: MANTENIMIENTO, nombre: "Mantenimiento", naturaleza: "opex" }),
    categoriaDePrueba({ id: CANON, nombre: "Canon", naturaleza: "ingreso" }),
  ]);
  let contador = 0;
  const nuevoId = () => `0f000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`;

  return {
    presupuestos,
    crear: new CrearPresupuesto(presupuestos, categorias, nuevoId),
    actualizar: new ActualizarPresupuesto(presupuestos),
    eliminar: new EliminarPresupuesto(presupuestos),
    listar: new ListarEjecucionPresupuestos(presupuestos),
    copiar: new CopiarPresupuestos(presupuestos, nuevoId),
  };
}

const MARZO = periodoMensual("2026-03");

describe("Periodos", () => {
  it("resuelve el mes y el año completos", () => {
    expect(periodoMensual("2026-02")).toEqual({ inicio: "2026-02-01", fin: "2026-02-28" });
    expect(periodoAnual(2026)).toEqual({ inicio: "2026-01-01", fin: "2026-12-31" });
  });

  it("el periodo siguiente conserva el tamaño (RF-83)", () => {
    expect(periodoSiguiente("2026-03-01", "2026-03-31")).toEqual({
      inicio: "2026-04-01",
      fin: "2026-04-30",
    });
    expect(periodoSiguiente("2026-12-01", "2026-12-31")).toEqual({
      inicio: "2027-01-01",
      fin: "2027-01-31",
    });
    expect(periodoSiguiente("2026-01-01", "2026-12-31")).toEqual({
      inicio: "2027-01-01",
      fin: "2027-12-31",
    });
  });
});

describe("Alertas (RF-82)", () => {
  it("los umbrales son el 80 % y el 100 %", () => {
    expect(nivelDeAlerta(0.5)).toBe("ok");
    expect(nivelDeAlerta(0.79)).toBe("ok");
    expect(nivelDeAlerta(0.8)).toBe("aviso");
    expect(nivelDeAlerta(0.99)).toBe("aviso");
    expect(nivelDeAlerta(1)).toBe("excedido");
    expect(nivelDeAlerta(1.4)).toBe("excedido");
  });

  it("sin ejecución calculable no hay alerta (guarda §5.3)", () => {
    expect(nivelDeAlerta(null)).toBeNull();
  });

  it("el resumen cuenta excedidos y avisos", () => {
    const resumen = resumirEjecucion([
      { valorPlaneado: 100, valorReal: 120, ejecucion: 1.2 },
      { valorPlaneado: 100, valorReal: 85, ejecucion: 0.85 },
      { valorPlaneado: 100, valorReal: 10, ejecucion: 0.1 },
    ]);

    expect(resumen).toMatchObject({
      planeado: 300,
      real: 215,
      desviacion: -85,
      excedidos: 1,
      enAviso: 1,
    });
  });
});

describe("CrearPresupuesto (RF-80)", () => {
  it("crea el presupuesto de un proyecto para un mes", async () => {
    const { crear } = montar();

    const presupuesto = await crear.ejecutar({
      proyectoId: PROYECTO,
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 800_000,
    });

    expect(presupuesto.proyectoId).toBe(PROYECTO);
    expect(presupuesto.valorPlaneado).toBe(800_000);
  });

  it("admite presupuesto global, sin proyecto", async () => {
    const { crear } = montar();

    const presupuesto = await crear.ejecutar({
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 1_000_000,
    });

    expect(presupuesto.proyectoId).toBeNull();
  });

  it("no se presupuestan categorías de ingreso", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({
        categoriaId: CANON,
        periodoInicio: MARZO.inicio,
        periodoFin: MARZO.fin,
        valorPlaneado: 100,
      }),
    ).rejects.toMatchObject({ codigo: "CATEGORIA_NO_PRESUPUESTABLE" });
  });

  it("rechaza dos presupuestos para la misma categoría y periodo", async () => {
    const { crear } = montar();
    const entrada = {
      proyectoId: PROYECTO,
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 500_000,
    };
    await crear.ejecutar(entrada);

    await expect(crear.ejecutar(entrada)).rejects.toMatchObject({
      codigo: "PRESUPUESTO_DUPLICADO",
    });
  });

  it("rechaza un periodo invertido", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({
        categoriaId: MANTENIMIENTO,
        periodoInicio: "2026-03-31",
        periodoFin: "2026-03-01",
        valorPlaneado: 100,
      }),
    ).rejects.toMatchObject({ codigo: "PERIODO_INVALIDO" });
  });
});

describe("ListarEjecucionPresupuestos (RF-81)", () => {
  it("trae planeado, real, desviación y el resumen", async () => {
    const { crear, listar, presupuestos } = montar();
    await crear.ejecutar({
      proyectoId: PROYECTO,
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 1_000_000,
    });
    presupuestos.realPorCategoria.set(`${MANTENIMIENTO}:${MARZO.inicio}`, 1_250_000);

    const { filas, resumen } = await listar.ejecutar({});

    expect(filas[0]).toMatchObject({
      valorPlaneado: 1_000_000,
      valorReal: 1_250_000,
      desviacion: 250_000,
    });
    expect(filas[0]?.ejecucion).toBeCloseTo(1.25, 6);
    expect(resumen.excedidos).toBe(1);
  });

  it("filtra por periodo vigente", async () => {
    const { crear, listar } = montar();
    const abril = periodoMensual("2026-04");
    await crear.ejecutar({
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 100,
    });
    await crear.ejecutar({
      categoriaId: MANTENIMIENTO,
      periodoInicio: abril.inicio,
      periodoFin: abril.fin,
      valorPlaneado: 200,
    });

    const { filas } = await listar.ejecutar({ filtro: { vigenteEn: "2026-04-15" } });

    expect(filas).toHaveLength(1);
    expect(filas[0]?.valorPlaneado).toBe(200);
  });
});

describe("CopiarPresupuestos (RF-83)", () => {
  it("copia todo el periodo al siguiente", async () => {
    const { crear, copiar, listar } = montar();
    await crear.ejecutar({
      proyectoId: PROYECTO,
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 800_000,
    });

    const resultado = await copiar.ejecutar({
      proyectoId: PROYECTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
    });

    expect(resultado).toMatchObject({ copiados: 1, omitidos: 0 });
    expect(resultado.destino).toEqual({ inicio: "2026-04-01", fin: "2026-04-30" });
    const { filas } = await listar.ejecutar({});
    expect(filas).toHaveLength(2);
  });

  it("copiar dos veces es inofensivo: los que ya existen se omiten", async () => {
    const { crear, copiar } = montar();
    await crear.ejecutar({
      proyectoId: PROYECTO,
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 800_000,
    });
    await copiar.ejecutar({
      proyectoId: PROYECTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
    });

    const segunda = await copiar.ejecutar({
      proyectoId: PROYECTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
    });

    expect(segunda).toMatchObject({ copiados: 0, omitidos: 1 });
  });

  it("un periodo sin presupuestos no se copia en silencio", async () => {
    const { copiar } = montar();

    await expect(
      copiar.ejecutar({ periodoInicio: MARZO.inicio, periodoFin: MARZO.fin }),
    ).rejects.toMatchObject({ codigo: "PERIODO_SIN_PRESUPUESTOS" });
  });
});

describe("Actualizar y eliminar", () => {
  it("actualizar cambia el valor planeado y las notas", async () => {
    const { crear, actualizar } = montar();
    const presupuesto = await crear.ejecutar({
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 500_000,
    });

    const actualizado = await actualizar.ejecutar({
      id: presupuesto.id,
      categoriaId: MANTENIMIENTO,
      periodoInicio: MARZO.inicio,
      periodoFin: MARZO.fin,
      valorPlaneado: 650_000,
      notas: "Se sumó la pintura de la fachada",
    });

    expect(actualizado.valorPlaneado).toBe(650_000);
    expect(actualizado.aDatos().notas).toBe("Se sumó la pintura de la fachada");
  });

  it("eliminar uno inexistente falla explícitamente", async () => {
    const { eliminar } = montar();

    await expect(
      eliminar.ejecutar({ id: "0f000000-0000-4000-8000-000000000099" }),
    ).rejects.toMatchObject({ codigo: "PRESUPUESTO_NO_ENCONTRADO" });
  });
});
