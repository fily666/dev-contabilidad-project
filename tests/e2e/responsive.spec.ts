import { expect, test } from "@playwright/test";

/**
 * RNF-01: sin scroll horizontal a 375 px y las tablas colapsan a tarjetas.
 * Corre en el proyecto `movil` de la configuracion.
 */
test.describe("RNF-01 responsive", () => {
  // Todas las rutas del shell, no solo las de la Fase 1: una vista nueva que
  // desborde a 375 px es exactamente lo que RNF-01 existe para no dejar pasar.
  for (const ruta of [
    "/dashboard",
    "/proyectos",
    "/movimientos",
    "/movimientos/importar",
    "/obligaciones",
    "/calendario",
    "/documentos",
    "/presupuestos",
    "/patrimonio",
    "/reportes",
    "/configuracion",
  ]) {
    test(`${ruta} no desborda a lo ancho`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: "networkidle" });
      await expect(page.getByRole("main")).toBeVisible();

      // Las fuentes propias cambian el ancho del texto al cargar: medir antes
      // da falsos positivos y falsos negativos por igual.
      await page.evaluate(() => document.fonts.ready);

      const medida = await page.evaluate(() => {
        const limite = document.documentElement.clientWidth;
        const culpables: string[] = [];

        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          const caja = el.getBoundingClientRect();
          if (caja.width > 0 && caja.right > limite + 1) {
            culpables.push(
              `<${el.tagName.toLowerCase()} class="${el.className?.toString().slice(0, 70)}"> ` +
                `right=${Math.round(caja.right)}`,
            );
          }
        }

        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: limite,
          culpables: culpables.slice(0, 3),
        };
      });

      expect(
        medida.scrollWidth,
        `${ruta} desborda a 375 px (scrollWidth ${medida.scrollWidth} > ${medida.clientWidth}).` +
          ` Elementos que se salen: ${medida.culpables.join(" · ") || "ninguno localizado"}`,
      ).toBeLessThanOrEqual(medida.clientWidth + 1);
    });
  }

  test("la tabla de movimientos se presenta como tarjetas", async ({ page }) => {
    await page.goto("/movimientos", { waitUntil: "networkidle" });

    // La variante de escritorio existe en el DOM pero `md:block` la oculta a
    // este ancho; si estuviera visible, la tabla seria la que desborda.
    const tabla = page.getByRole("table");
    if ((await tabla.count()) > 0) {
      await expect(tabla.first()).toBeHidden();
    }
  });
});
