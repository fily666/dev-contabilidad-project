import { expect, type Locator, type Page } from "@playwright/test";

import { PREFIJO_E2E } from "./entorno";

/** Nombre unico por corrida, para que dos ejecuciones no colisionen. */
export function nombreDePrueba(sufijo: string): string {
  return `${PREFIJO_E2E} ${sufijo} ${Date.now().toString(36)}`;
}

/**
 * Nombre accesible exacto de un campo a partir de su etiqueta visible.
 *
 * Los obligatorios anaden un asterisco dentro del `<label>` («Valor *») y los
 * atributos dinamicos anaden « obligatorio». El ancla de fin es lo que importa:
 * sin ella «Fecha» tambien casaria con «Fecha de vencimiento», y «Tipo» con
 * «Tipo de proyecto».
 */
function porEtiqueta(etiqueta: string): RegExp {
  const escapada = etiqueta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escapada}( \\*| obligatorio)?$`);
}

/**
 * Elige una opcion de un Select de Base UI. No es un `<select>` nativo: el
 * disparador es un `combobox` y las opciones aparecen en un `listbox` flotante
 * fuera del ambito, por eso las opciones se buscan en la pagina completa.
 */
async function elegir(
  page: Page,
  ambito: Page | Locator,
  etiqueta: string,
  opcion: string | RegExp,
): Promise<void> {
  const disparador = ambito.getByRole("combobox", { name: porEtiqueta(etiqueta) });
  await disparador.click();

  const elegida = page.getByRole("option", { name: opcion }).first();
  await expect(elegida).toBeVisible();
  await elegida.click();

  // El listbox se cierra al elegir; esperarlo evita que el clic siguiente caiga
  // sobre el menu que todavia esta desapareciendo.
  await expect(page.getByRole("listbox")).toBeHidden();
}

export type DatosProyecto = {
  tipo: string | RegExp;
  nombre: string;
  fechaInicio: string;
  /** Atributos dinamicos del tipo (RF-14), por etiqueta visible. */
  atributos?: Record<string, string>;
};

/** RF-10 a RF-14: crea un proyecto y devuelve la URL de su detalle. */
export async function crearProyecto(page: Page, datos: DatosProyecto): Promise<string> {
  await page.goto("/proyectos/nuevo");

  const formulario = page.getByRole("main");

  await elegir(page, formulario, "Tipo de proyecto", datos.tipo);
  await formulario.getByRole("textbox", { name: porEtiqueta("Nombre") }).fill(datos.nombre);
  await formulario
    .getByRole("textbox", { name: porEtiqueta("Fecha de inicio") })
    .fill(datos.fechaInicio);

  // Los atributos aparecen al elegir el tipo: se generan desde
  // `tipos_proyecto.configuracion` sin condicionales en la interfaz (§13).
  // Los requeridos anaden « obligatorio» al nombre accesible, de ahi el ancla.
  for (const [etiqueta, valor] of Object.entries(datos.atributos ?? {})) {
    await formulario
      .getByRole(/^(Área|Estrato|Modelo|Cilindraje)/.test(etiqueta) ? "spinbutton" : "textbox", {
        name: porEtiqueta(etiqueta),
      })
      .fill(valor);
  }

  await formulario.getByRole("button", { name: "Crear proyecto" }).click();

  await expect(page.getByRole("heading", { name: datos.nombre, level: 1 })).toBeVisible();
  return page.url();
}

export type DatosMovimiento = {
  tipo: "Ingreso" | "Egreso";
  categoria: string | RegExp;
  valor: string;
  fecha: string;
  descripcion: string;
  /** Los indicadores de caja solo cuentan lo pagado (regla de oro §2). */
  pagado?: boolean;
  metodoPago?: string | RegExp;
};

/** RF-20, RF-21, RF-26: registra un movimiento desde el detalle del proyecto. */
export async function registrarMovimiento(page: Page, datos: DatosMovimiento): Promise<void> {
  // El disparador se llama «Registrar movimiento» en el detalle del proyecto y
  // «Nuevo movimiento» en los listados. Se busca dentro de `main` porque el
  // dialogo se monta en un portal fuera de ahi y su boton de envio lleva el
  // mismo texto: sin acotar, el localizador seria ambiguo.
  await page
    .getByRole("main")
    .getByRole("button", { name: /^(Nuevo|Registrar) movimiento$/ })
    .first()
    .click();

  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByRole("heading", { name: "Registrar movimiento" })).toBeVisible();

  await elegir(page, dialogo, "Tipo", datos.tipo);
  await elegir(page, dialogo, "Categoría", datos.categoria);

  await dialogo.getByRole("textbox", { name: porEtiqueta("Valor") }).fill(datos.valor);
  await dialogo.getByRole("textbox", { name: porEtiqueta("Fecha") }).fill(datos.fecha);
  await dialogo.getByRole("textbox", { name: porEtiqueta("Descripción") }).fill(datos.descripcion);

  // El formulario propone «pagado» para un movimiento nuevo, asi que hay que
  // comprobar el estado real antes de tocarlo. `isChecked` lee la semantica
  // ARIA del Switch de Base UI, que no siempre es un input nativo.
  const pagado = datos.pagado === true;
  const interruptor = dialogo.getByRole("switch", { name: "Ya está pagado" });

  if ((await interruptor.isChecked()) !== pagado) await interruptor.click();
  await expect(interruptor).toBeChecked({ checked: pagado });

  // §5.7.4: un movimiento pagado exige fecha de pago y metodo.
  if (pagado) {
    await elegir(page, dialogo, "Método de pago", datos.metodoPago ?? /.+/);
  }

  await dialogo.getByRole("button", { name: "Registrar movimiento" }).click();

  // Si el dialogo no se cierra, el motivo esta escrito en pantalla: mostrarlo
  // ahorra abrir el informe para saber que restriccion se rompio.
  try {
    await expect(dialogo).toBeHidden();
  } catch (error) {
    const visibles = await dialogo.locator(".text-destructive").allInnerTexts();
    throw new Error(
      `El movimiento «${datos.descripcion}» no se guardó. Errores en pantalla: ${
        visibles.filter(Boolean).join(" | ") || "(ninguno visible; revisa el toast)"
      }`,
      { cause: error },
    );
  }
}

/** Tarjeta de indicador por su etiqueta (§5.4). */
export function indicador(page: Page, etiqueta: string): Locator {
  return page.locator(`[data-indicador="${etiqueta}"]`);
}
