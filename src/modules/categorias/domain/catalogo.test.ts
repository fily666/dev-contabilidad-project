import { describe, expect, it } from "vitest";

import { categoriasDelTipo, sirveParaTipo } from "./catalogo";
import type { CategoriaConRuta } from "./categoria.repository";

function categoria(id: string, nombre: string, tipoProyectoId: string | null): CategoriaConRuta {
  return {
    id,
    nombre,
    ruta: nombre,
    padreId: null,
    padreNombre: null,
    naturaleza: "capex",
    esSistema: true,
    activa: true,
    esRaiz: true,
    tipoProyectoId,
  };
}

const INMUEBLE = "t-inmueble";
const VEHICULO = "t-vehiculo";

// Las dos se llaman «Adquisición»: es la duplicidad que veia el usuario.
const ADQ_INMUEBLE = categoria("c1", "Adquisición", INMUEBLE);
const ADQ_VEHICULO = categoria("c2", "Adquisición", VEHICULO);
const TRANSVERSAL = categoria("c3", "Financiación", null);

const CATALOGO = [ADQ_INMUEBLE, ADQ_VEHICULO, TRANSVERSAL];

describe("categoriasDelTipo", () => {
  it("deja las del tipo y las transversales", () => {
    expect(categoriasDelTipo(CATALOGO, VEHICULO)).toEqual([ADQ_VEHICULO, TRANSVERSAL]);
  });

  it("no filtra sin tipo: la pantalla del proyecto ya recibe el catalogo acotado", () => {
    expect(categoriasDelTipo(CATALOGO, undefined)).toEqual(CATALOGO);
  });
});

describe("sirveParaTipo", () => {
  it("descarta la categoria de otro tipo", () => {
    expect(sirveParaTipo(CATALOGO, ADQ_INMUEBLE.id, VEHICULO)).toBe(false);
  });

  it("conserva la del mismo tipo y la transversal", () => {
    expect(sirveParaTipo(CATALOGO, ADQ_VEHICULO.id, VEHICULO)).toBe(true);
    expect(sirveParaTipo(CATALOGO, TRANSVERSAL.id, VEHICULO)).toBe(true);
  });

  it("no decide cuando falta el dato", () => {
    expect(sirveParaTipo(CATALOGO, "", VEHICULO)).toBe(true);
    expect(sirveParaTipo(CATALOGO, ADQ_INMUEBLE.id, undefined)).toBe(true);
    expect(sirveParaTipo(CATALOGO, "desconocida", VEHICULO)).toBe(true);
  });
});
