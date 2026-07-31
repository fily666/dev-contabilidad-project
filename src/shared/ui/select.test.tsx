// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const APARTAMENTO = { id: "a9d1da96-43d6-422a-8338-838d64d7d671", nombre: "Apartamento 402" };
const PROYECTOS = [
  APARTAMENTO,
  { id: "2f0f6d64-6c7d-4a1a-9a0f-0b0d2f0f6d64", nombre: "Camioneta" },
];

function SelectorProyecto({ valor }: { valor?: string }) {
  return (
    <Select value={valor ?? null}>
      <SelectTrigger>
        <SelectValue placeholder="Selecciona un proyecto" />
      </SelectTrigger>
      <SelectContent>
        {PROYECTOS.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("muestra el nombre de la opcion elegida y no su identificador", () => {
    render(<SelectorProyecto valor={APARTAMENTO.id} />);

    expect(screen.getByRole("combobox")).toHaveTextContent("Apartamento 402");
    expect(screen.getByRole("combobox")).not.toHaveTextContent(APARTAMENTO.id);
  });

  it("conserva el marcador de posicion cuando no hay valor", () => {
    render(<SelectorProyecto />);

    expect(screen.getByRole("combobox")).toHaveTextContent("Selecciona un proyecto");
  });
});
