import { expect, test } from "@playwright/test";

import { crearProyecto, indicador, nombreDePrueba, registrarMovimiento } from "./utils/acciones";

/**
 * Escenario de referencia §3.2 — «Compra de motocicleta».
 *
 * No genera ingresos y se deprecia: el eje es el costo de propiedad. Lo que
 * verifica esta prueba es tanto lo que se muestra como lo que NO se muestra,
 * porque §5.4 exige que la rentabilidad no aparezca en un proyecto sin ingresos.
 */
test.describe("§3.2 Vehículo", () => {
  test("registra el TCO y no muestra rentabilidad", async ({ page }) => {
    const nombre = nombreDePrueba("Moto XR 190");

    await crearProyecto(page, {
      tipo: /^Vehículo$/,
      nombre,
      fechaInicio: "2026-02-01",
      atributos: { Placa: "ABC12D", Marca: "Honda" },
    });

    await registrarMovimiento(page, {
      tipo: "Egreso",
      categoria: "Adquisición › Valor de compra",
      valor: "18000000",
      fecha: "2026-02-01",
      descripcion: "Valor de compra de la moto",
      pagado: true,
    });

    await registrarMovimiento(page, {
      tipo: "Egreso",
      categoria: "Adquisición › Matrícula",
      valor: "1000000",
      fecha: "2026-02-03",
      descripcion: "Matrícula y trámites",
      pagado: true,
    });

    await registrarMovimiento(page, {
      tipo: "Egreso",
      categoria: "Documentos e impuestos › SOAT",
      valor: "500000",
      fecha: "2026-02-10",
      descripcion: "SOAT anual",
      pagado: true,
    });

    await page.reload();

    // §5.3: TCO es todo lo desembolsado (19,5 M); compra y matrícula capitalizan
    // (19 M) y el SOAT es OPEX, así que no entra en la inversión.
    await expect(indicador(page, "Costo total (TCO)")).toContainText("19,5 M");
    await expect(indicador(page, "Total invertido")).toContainText("19 M");
    await expect(indicador(page, "Costo mensual")).toBeVisible();

    // §5.4: sin ingresos no hay rentabilidad que mostrar.
    await expect(indicador(page, "ROI acumulado")).toHaveCount(0);
    await expect(indicador(page, "Yield neto")).toHaveCount(0);
    await expect(indicador(page, "Cap rate")).toHaveCount(0);
  });

  test("la plusvalía es «—» mientras no haya valoración", async ({ page }) => {
    const nombre = nombreDePrueba("Moto sin valoración");

    await crearProyecto(page, {
      tipo: /^Vehículo$/,
      nombre,
      fechaInicio: "2026-02-01",
      // Placa y Marca son obligatorias en la configuración del tipo (§13).
      atributos: { Placa: "XYZ98W", Marca: "Yamaha" },
    });

    // Guarda de §5.3: sin valoracion el indicador es «—», nunca 0 ni NaN.
    await expect(indicador(page, "Plusvalía")).toContainText("—");
  });
});
