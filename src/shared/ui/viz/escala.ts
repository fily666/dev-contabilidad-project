/**
 * Utilidades de escala para las graficas. Los ejes se redondean a numeros
 * limpios: son los que cargan los valores que no se etiquetan directamente.
 */

/** Marcas de eje redondeadas (0, 1.000, 2.000…) para un maximo dado. */
export function marcasDeEje(maximo: number, cantidad = 4): number[] {
  if (!Number.isFinite(maximo) || maximo <= 0) return [0];

  const bruto = maximo / cantidad;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= bruto) ?? 10 * magnitud;
  const techo = Math.ceil(maximo / paso) * paso;

  const marcas: number[] = [];
  for (let v = 0; v <= techo + paso / 1000; v += paso) marcas.push(v);
  return marcas;
}

/** Porcentaje de altura/ancho de una marca respecto al techo del eje. */
export function proporcion(valor: number, techo: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(techo) || techo <= 0) return 0;
  return Math.max(0, Math.min(1, valor / techo));
}

/** Razon acotada a 0..1 para medidores; `null` cuando no es calculable. */
export function razonAcotada(valor: number | null | undefined, base: number): number | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null;
  if (!Number.isFinite(base) || base <= 0) return null;
  return Math.max(0, Math.min(1, valor / base));
}
