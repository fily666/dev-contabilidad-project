import { describe, expect, it } from "vitest";

import {
  ActualizarCategoria,
  CambiarEstadoCategoria,
  CrearCategoria,
  EliminarCategoria,
  ListarCategorias,
} from "./casos-de-uso";
import { CategoriaRepositoryEnMemoria, categoriaDePrueba } from "./dobles";

/** Contexto.md §8.8: casos de uso del catalogo de categorias (RF-30 a RF-34). */

const RAIZ = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const SISTEMA = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";

function montar() {
  const categorias = new CategoriaRepositoryEnMemoria([
    categoriaDePrueba({ id: RAIZ, nombre: "Adquisición", naturaleza: "capex" }),
    categoriaDePrueba({
      id: SISTEMA,
      nombre: "Impuesto predial",
      naturaleza: "opex",
      esSistema: true,
    }),
  ]);
  let contador = 0;
  const nuevoId = () => `eeeeeeee-eeee-4eee-8eee-eeeeeeeeee${String(++contador).padStart(2, "0")}`;

  return {
    categorias,
    listar: new ListarCategorias(categorias),
    crear: new CrearCategoria(categorias, nuevoId),
    actualizar: new ActualizarCategoria(categorias),
    cambiarEstado: new CambiarEstadoCategoria(categorias),
    eliminar: new EliminarCategoria(categorias),
  };
}

describe("CrearCategoria (RF-31, RF-32)", () => {
  it("crea una categoria raiz con su naturaleza declarada (ADR-06)", async () => {
    const { crear } = montar();

    const categoria = await crear.ejecutar({ nombre: "Remodelación", naturaleza: "capex" });

    expect(categoria.naturaleza).toBe("capex");
    expect(categoria.esRaiz).toBe(true);
    expect(categoria.esSistema).toBe(false);
  });

  it("la subcategoria hereda naturaleza y tipo de proyecto del padre", async () => {
    const { crear } = montar();

    const subcategoria = await crear.ejecutar({
      nombre: "Cuota inicial",
      naturaleza: "ingreso",
      padreId: RAIZ,
    });

    expect(subcategoria.naturaleza).toBe("capex");
    expect(subcategoria.padreId).toBe(RAIZ);
  });

  it("no admite un tercer nivel de jerarquia", async () => {
    const { crear } = montar();
    const sub = await crear.ejecutar({
      nombre: "Cuota inicial",
      naturaleza: "capex",
      padreId: RAIZ,
    });

    await expect(
      crear.ejecutar({ nombre: "Nieta", naturaleza: "capex", padreId: sub.id }),
    ).rejects.toMatchObject({ codigo: "JERARQUIA_INVALIDA" });
  });

  it("rechaza nombres duplicados en el mismo nivel", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({ nombre: "adquisición", naturaleza: "capex" }),
    ).rejects.toMatchObject({ codigo: "CATEGORIA_DUPLICADA" });
  });

  it("falla si el padre indicado no existe", async () => {
    const { crear } = montar();

    await expect(
      crear.ejecutar({
        nombre: "Huérfana",
        naturaleza: "capex",
        padreId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc9",
      }),
    ).rejects.toMatchObject({ codigo: "CATEGORIA_PADRE_NO_ENCONTRADO" });
  });
});

describe("ActualizarCategoria (RF-31)", () => {
  it("renombra y cambia la naturaleza de una categoria raiz propia", async () => {
    const { actualizar } = montar();

    const categoria = await actualizar.ejecutar({
      id: RAIZ,
      nombre: "Adquisición del inmueble",
      naturaleza: "opex",
    });

    expect(categoria.nombre).toBe("Adquisición del inmueble");
    expect(categoria.naturaleza).toBe("opex");
  });

  it("no toca las categorias del sistema (RF-34)", async () => {
    const { actualizar } = montar();

    await expect(actualizar.ejecutar({ id: SISTEMA, nombre: "Otro nombre" })).rejects.toMatchObject(
      { codigo: "CATEGORIA_DEL_SISTEMA" },
    );
  });
});

describe("CambiarEstadoCategoria (RF-34)", () => {
  it("oculta y reactiva, incluidas las del sistema", async () => {
    const { cambiarEstado, listar } = montar();

    const oculta = await cambiarEstado.ejecutar({ id: SISTEMA, activa: false });
    expect(oculta.activa).toBe(false);

    const activas = await listar.ejecutar({ filtro: { soloActivas: true } });
    expect(activas.map((c) => c.id)).not.toContain(SISTEMA);

    const todas = await listar.ejecutar({ filtro: { soloActivas: false } });
    expect(todas.map((c) => c.id)).toContain(SISTEMA);

    const reactivada = await cambiarEstado.ejecutar({ id: SISTEMA, activa: true });
    expect(reactivada.activa).toBe(true);
  });
});

describe("EliminarCategoria (RF-34)", () => {
  it("elimina una categoria propia sin movimientos", async () => {
    const { eliminar, categorias } = montar();

    await eliminar.ejecutar({ id: RAIZ });

    expect(categorias.eliminados).toEqual([RAIZ]);
  });

  it("se niega con las del sistema y con las que estan en uso", async () => {
    const { eliminar, categorias } = montar();

    await expect(eliminar.ejecutar({ id: SISTEMA })).rejects.toMatchObject({
      codigo: "CATEGORIA_DEL_SISTEMA",
    });

    categorias.movimientosPorCategoria.set(RAIZ, 4);
    await expect(eliminar.ejecutar({ id: RAIZ })).rejects.toMatchObject({
      codigo: "CATEGORIA_EN_USO",
    });
    expect(categorias.eliminados).toEqual([]);
  });
});

describe("ListarCategorias (RF-30)", () => {
  it("devuelve la ruta legible «Padre › Hijo» y filtra por naturaleza", async () => {
    const { crear, listar } = montar();
    await crear.ejecutar({ nombre: "Cuota inicial", naturaleza: "capex", padreId: RAIZ });

    const capex = await listar.ejecutar({ filtro: { naturalezas: ["capex"] } });

    expect(capex.map((c) => c.ruta)).toContain("Adquisición › Cuota inicial");
    expect(capex.every((c) => c.naturaleza === "capex")).toBe(true);
  });
});
