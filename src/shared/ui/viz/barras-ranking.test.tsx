// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BarrasRanking } from "./barras-ranking";

/**
 * Dos categorias raiz distintas pueden llamarse igual: «Operación» existe en el
 * catalogo de vehiculo y en el de negocio (`seed.sql`). Sin `clave`, React
 * avisaba de claves duplicadas en el panel «Gasto por categoría».
 */
const FILAS = [
  { clave: "cat-vehiculo", etiqueta: "Operación", valor: 11_000_000 },
  { clave: "cat-negocio", etiqueta: "Operación", valor: 52_000_000 },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BarrasRanking", () => {
  it("dibuja una barra por fila aunque dos etiquetas coincidan", () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<BarrasRanking filas={FILAS} moneda="COP" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(errores).not.toHaveBeenCalled();
  });
});
