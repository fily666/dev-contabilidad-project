import type { EstadoMovimiento, TipoMovimiento } from "@/shared/domain/enumeraciones";
import { esFechaIso, type FechaIso } from "@/shared/domain/reloj";

/**
 * Lectura de un CSV de movimientos (Contexto.md RF-27).
 *
 * Se escribe a mano en lugar de traer un parser: el formato admitido es una sola
 * hoja con comillas dobles opcionales, y una dependencia mas en §8.1 para eso no
 * se justifica. Lo que si importa es que **ninguna fila invalida detenga la
 * lectura**: RF-27 pide previsualizacion y validacion fila por fila, asi que cada
 * fila lleva sus propios errores y el usuario decide.
 */

export const COLUMNAS_ESPERADAS = [
  "fecha",
  "tipo",
  "categoria",
  "valor",
  "descripcion",
  "metodo_pago",
  "estado",
  "observaciones",
  "proyecto",
] as const;

export type ColumnaCsv = (typeof COLUMNAS_ESPERADAS)[number];

/** Columnas sin las que no se puede construir un movimiento. */
const OBLIGATORIAS: ColumnaCsv[] = ["fecha", "tipo", "categoria", "valor", "descripcion"];

export type FilaCruda = Partial<Record<ColumnaCsv, string>> & { numero: number };

export type FilaImportacion = {
  numero: number;
  crudo: Partial<Record<ColumnaCsv, string>>;
  /** Datos ya convertidos; `null` cuando la fila no es utilizable. */
  datos: {
    fecha: FechaIso;
    tipo: TipoMovimiento;
    categoria: string;
    valor: number;
    descripcion: string;
    metodoPago: string | null;
    estado: Extract<EstadoMovimiento, "pendiente" | "pagado">;
    observaciones: string | null;
    proyecto: string | null;
  } | null;
  errores: string[];
};

export type LecturaCsv = {
  filas: FilaImportacion[];
  /** Columnas del encabezado que no se reconocen; se ignoran, pero se dicen. */
  columnasDesconocidas: string[];
  columnasFaltantes: ColumnaCsv[];
};

/** RF-27: tope de filas por archivo. Mas que eso es una migracion, no una carga. */
export const MAXIMO_FILAS_CSV = 2_000;

/**
 * Divide una linea de CSV respetando las comillas dobles. Soporta el separador
 * `,` y `;`, porque Excel en es-CO exporta con punto y coma.
 */
function partirLinea(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let enComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];

    if (caracter === '"') {
      // Dos comillas seguidas dentro de un campo entrecomillado son una comilla.
      if (enComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        enComillas = !enComillas;
      }
      continue;
    }

    if (caracter === separador && !enComillas) {
      campos.push(actual.trim());
      actual = "";
      continue;
    }

    actual += caracter;
  }

  campos.push(actual.trim());
  return campos;
}

function detectarSeparador(encabezado: string): string {
  const comas = (encabezado.match(/,/g) ?? []).length;
  const puntoYComa = (encabezado.match(/;/g) ?? []).length;
  return puntoYComa > comas ? ";" : ",";
}

function normalizarClave(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

/**
 * Acepta «1.250.000,50», «1250000.5», «1,250,000» y «$ 450.000».
 *
 * La convencion de es-CO es coma decimal y punto de miles, pero un CSV exportado
 * de una herramienta en ingles llega al contrario, asi que se decide por la forma
 * del numero y no por una configuracion:
 *
 *   - Con los dos separadores, el ultimo que aparece es el decimal.
 *   - Con uno repetido, es de miles: «1.250.000» no puede ser un decimal.
 *   - Con un punto solo, es decimal salvo que le sigan exactamente tres cifras,
 *     donde manda es-CO y es de miles: «450.000» son cuatrocientos cincuenta mil.
 *   - Con una coma sola, es decimal, que es lo que escribe quien teclea en es-CO.
 */
export function leerValorCsv(crudo: string): number {
  const limpio = crudo.replace(/[^\d,.-]/g, "");
  if (limpio === "" || !/\d/.test(limpio)) return Number.NaN;

  const comas = (limpio.match(/,/g) ?? []).length;
  const puntos = (limpio.match(/\./g) ?? []).length;

  if (comas > 0 && puntos > 0) {
    const decimal = limpio.lastIndexOf(",") > limpio.lastIndexOf(".") ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    return Number(limpio.split(miles).join("").replace(decimal, "."));
  }

  if (puntos > 0) {
    const decimales = limpio.length - limpio.lastIndexOf(".") - 1;
    if (puntos === 1 && decimales !== 3) return Number(limpio);
    return Number(limpio.split(".").join(""));
  }

  if (comas > 0) {
    if (comas === 1) return Number(limpio.replace(",", "."));
    return Number(limpio.split(",").join(""));
  }

  return Number(limpio);
}

/** Acepta `2026-03-05`, `05/03/2026` y `5-3-2026`. */
export function leerFechaCsv(crudo: string): FechaIso | null {
  const texto = crudo.trim();
  if (esFechaIso(texto)) return texto;

  const partes = texto.split(/[/\-.]/).map((p) => p.trim());
  if (partes.length !== 3) return null;

  const [a, b, c] = partes as [string, string, string];
  // Con cuatro digitos al final es dd/MM/yyyy; el formato de es-CO.
  if (c.length === 4) {
    const iso = `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    return esFechaIso(iso) ? iso : null;
  }
  if (a.length === 4) {
    const iso = `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
    return esFechaIso(iso) ? iso : null;
  }
  return null;
}

/** Lee el CSV completo y valida forma; la existencia de catalogos la valida el caso de uso. */
export function leerCsvDeMovimientos(contenido: string): LecturaCsv {
  const lineas = contenido
    .replace(/^﻿/, "") // BOM de Excel
    .split(/\r?\n/)
    .filter((linea) => linea.trim() !== "");

  if (lineas.length === 0) {
    return { filas: [], columnasDesconocidas: [], columnasFaltantes: [...OBLIGATORIAS] };
  }

  const separador = detectarSeparador(lineas[0]!);
  const encabezado = partirLinea(lineas[0]!, separador).map(normalizarClave);

  const columnasFaltantes = OBLIGATORIAS.filter((columna) => !encabezado.includes(columna));
  const columnasDesconocidas = encabezado.filter(
    (columna) => !(COLUMNAS_ESPERADAS as readonly string[]).includes(columna),
  );

  const filas: FilaImportacion[] = lineas.slice(1, MAXIMO_FILAS_CSV + 1).map((linea, indice) => {
    const campos = partirLinea(linea, separador);
    const crudo: Partial<Record<ColumnaCsv, string>> = {};

    encabezado.forEach((columna, posicion) => {
      if ((COLUMNAS_ESPERADAS as readonly string[]).includes(columna)) {
        crudo[columna as ColumnaCsv] = campos[posicion] ?? "";
      }
    });

    return validarFila({ ...crudo, numero: indice + 2 });
  });

  return { filas, columnasDesconocidas, columnasFaltantes };
}

function validarFila(fila: FilaCruda): FilaImportacion {
  const errores: string[] = [];
  const { numero, ...crudo } = fila;

  const fecha = leerFechaCsv(crudo.fecha ?? "");
  if (fecha === null) errores.push("La fecha no es válida (usa AAAA-MM-DD o DD/MM/AAAA).");

  const tipoCrudo = normalizarClave(crudo.tipo ?? "");
  const tipo: TipoMovimiento | null =
    tipoCrudo === "ingreso" ? "ingreso" : tipoCrudo === "egreso" ? "egreso" : null;
  if (tipo === null) errores.push("El tipo debe ser «ingreso» o «egreso».");

  const categoria = (crudo.categoria ?? "").trim();
  if (categoria === "") errores.push("Falta la categoría.");

  const valor = leerValorCsv(crudo.valor ?? "");
  if (!Number.isFinite(valor)) errores.push("El valor no es numérico.");
  else if (valor <= 0) errores.push("El valor debe ser mayor que cero.");

  const descripcion = (crudo.descripcion ?? "").trim();
  if (descripcion === "") errores.push("Falta la descripción.");
  else if (descripcion.length > 200) errores.push("La descripción supera 200 caracteres.");

  const estadoCrudo = normalizarClave(crudo.estado ?? "");
  let estado: "pendiente" | "pagado" = "pagado";
  if (estadoCrudo === "") estado = "pagado";
  else if (estadoCrudo === "pendiente") estado = "pendiente";
  else if (estadoCrudo === "pagado") estado = "pagado";
  else errores.push("El estado debe ser «pendiente» o «pagado».");

  const metodoPago = (crudo.metodo_pago ?? "").trim() || null;
  if (estado === "pagado" && metodoPago === null) {
    errores.push("Un movimiento pagado necesita método de pago.");
  }

  return {
    numero,
    crudo,
    errores,
    datos:
      errores.length > 0 || fecha === null || tipo === null
        ? null
        : {
            fecha,
            tipo,
            categoria,
            valor,
            descripcion,
            metodoPago,
            estado,
            observaciones: (crudo.observaciones ?? "").trim() || null,
            proyecto: (crudo.proyecto ?? "").trim() || null,
          },
  };
}

/** Plantilla que se ofrece para descargar: el formato explicado con un ejemplo. */
export const PLANTILLA_CSV = [
  COLUMNAS_ESPERADAS.join(","),
  "2026-03-05,egreso,Administración,450000,Administración marzo,Transferencia,pagado,,",
  "2026-03-10,ingreso,Canon de arrendamiento,2000000,Canon marzo,Transferencia,pagado,,",
  "2026-04-01,egreso,Mantenimiento,180000,Cambio de aceite,,pendiente,Pendiente de factura,",
].join("\n");
