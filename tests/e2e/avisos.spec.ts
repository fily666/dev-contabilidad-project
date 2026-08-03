import { expect, test } from "@playwright/test";

/**
 * RF-59 y Contexto.md §10.2: la campana de avisos in-app.
 *
 * Es la capa que ninguna otra prueba alcanza. Los casos de uso están cubiertos con
 * dobles y el esquema con PGlite, pero entre ambos quedan la Server Action y el
 * render del shell, y ahí vivían los dos defectos que este trabajo encontró: una
 * columna que no existía en la base y un `on conflict` que no podía cumplirse.
 *
 * No siembra avisos: usa los que haya. Si la instalación no tiene ninguno
 * publicado, verifica el estado vacío, que también es comportamiento (§10.2). Para
 * generarlos, `GET /api/cron/notificaciones` con `CRON_SECRET` (README).
 */
test.describe("RF-59 campana de avisos", () => {
  test("la campana vive en el shell y dice cuántos avisos hay sin leer", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    // La etiqueta lleva el conteo, así que sirve de aserción y de sonda a la vez.
    const campana = page.getByRole("button", { name: /^Avisos:/ });
    await expect(campana).toBeVisible();

    await campana.click();

    // Por el `data-slot` y no por el texto: «Avisos» aparece también en el título
    // del panel y en el menú lateral, y en modo estricto eso es una ambigüedad.
    const panel = page.locator('[data-slot="popover-content"]');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "Ver todos los avisos" })).toBeVisible();
  });

  test("marcar todo como leído deja la campana en cero y el estado sobrevive a recargar", async ({
    page,
  }) => {
    await page.goto("/avisos", { waitUntil: "networkidle" });

    const sinLeer = page.getByRole("button", { name: /^Avisos: \d+ sin leer$/ });

    if (!(await sinLeer.isVisible().catch(() => false))) {
      // Nada sin leer: la campana debe decirlo en lugar de mostrar una insignia vacía.
      await expect(page.getByRole("button", { name: "Avisos: ninguno sin leer" })).toBeVisible();
      return;
    }

    await page.getByRole("button", { name: "Marcar todo como leído" }).click();

    // Sin recargar: la acción revalida el layout, así que la insignia baja sola.
    await expect(page.getByRole("button", { name: "Avisos: ninguno sin leer" })).toBeVisible();

    // Y con recarga: si `leida_en` no se hubiera escrito, el conteo volvería.
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Avisos: ninguno sin leer" })).toBeVisible();
  });
});
