import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { GeneradorPdf } from "@/modules/reportes/domain/exportadores";
import type { ColumnaReporte, FilaReporte, Reporte } from "@/modules/reportes/domain/reporte";

/**
 * ADAPTADOR del puerto GeneradorPdf (Contexto.md §7.3, §11).
 *
 * Encabezado con titulo, filtros aplicados y fecha de generacion; tabla paginada
 * con numero de pagina al pie y totales al cierre (RF-95).
 *
 * Se usan las fuentes estandar de PDF (Helvetica) a proposito: registrar una
 * tipografia propia obligaria a servir el archivo desde el bundle y no aporta
 * nada a un reporte que se imprime o se archiva.
 */

const estilos = StyleSheet.create({
  pagina: { padding: 28, fontSize: 8, fontFamily: "Helvetica", color: "#111827" },
  titulo: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitulo: { fontSize: 8, color: "#6b7280", marginBottom: 10 },
  filtros: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  filtro: { fontSize: 7, color: "#374151" },
  encabezado: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 3,
    marginBottom: 2,
  },
  fila: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 2.5,
  },
  celda: { paddingRight: 4 },
  celdaEncabezado: { fontFamily: "Helvetica-Bold", fontSize: 7.5, paddingRight: 4 },
  totales: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#111827", paddingTop: 6 },
  totalFila: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  pie: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#6b7280",
  },
});

function formatearNumero(valor: number, moneda: string, tipo: ColumnaReporte["tipo"]): string {
  if (tipo === "porcentaje") {
    return `${(valor * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
  }
  if (tipo === "dinero") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(valor);
  }
  return valor.toLocaleString("es-CO");
}

function textoDeCelda(fila: FilaReporte, columna: ColumnaReporte, moneda: string): string {
  const valor = fila[columna.clave];
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "number") return formatearNumero(valor, moneda, columna.tipo);
  return String(valor);
}

/** Ancho relativo de cada columna, derivado del ancho sugerido del reporte. */
function proporciones(columnas: ColumnaReporte[]): number[] {
  const anchos = columnas.map((c) => c.ancho ?? 18);
  const suma = anchos.reduce((a, b) => a + b, 0);
  return anchos.map((ancho) => ancho / suma);
}

function DocumentoReporte({ reporte }: { reporte: Reporte }) {
  const pesos = proporciones(reporte.columnas);
  const generado = new Date(reporte.generadoEn).toLocaleString("es-CO");

  return (
    <Document title={reporte.titulo} author="Gestor Financiero">
      <Page size="A4" orientation="landscape" style={estilos.pagina} wrap>
        <Text style={estilos.titulo}>{reporte.titulo}</Text>
        <Text style={estilos.subtitulo}>
          Generado el {generado} · {reporte.filas.length} registro(s) · moneda {reporte.moneda}
        </Text>

        <View style={estilos.filtros}>
          {reporte.filtros.map((filtro) => (
            <Text key={filtro.etiqueta} style={estilos.filtro}>
              {filtro.etiqueta}: {filtro.valor}
            </Text>
          ))}
        </View>

        <View style={estilos.encabezado} fixed>
          {reporte.columnas.map((columna, indice) => (
            <Text
              key={columna.clave}
              style={[
                estilos.celdaEncabezado,
                {
                  width: `${(pesos[indice] ?? 0) * 100}%`,
                  textAlign:
                    columna.tipo === "dinero" || columna.tipo === "numero" ? "right" : "left",
                },
              ]}
            >
              {columna.etiqueta}
            </Text>
          ))}
        </View>

        {reporte.filas.map((fila, indiceFila) => (
          <View key={indiceFila} style={estilos.fila} wrap={false}>
            {reporte.columnas.map((columna, indice) => (
              <Text
                key={columna.clave}
                style={[
                  estilos.celda,
                  {
                    width: `${(pesos[indice] ?? 0) * 100}%`,
                    textAlign:
                      columna.tipo === "dinero" || columna.tipo === "numero" ? "right" : "left",
                  },
                ]}
              >
                {textoDeCelda(fila, columna, reporte.moneda)}
              </Text>
            ))}
          </View>
        ))}

        <View style={estilos.totales}>
          {reporte.totales.map((total) => (
            <View key={total.etiqueta} style={estilos.totalFila}>
              <Text>{total.etiqueta}</Text>
              {/*
                El tipo lo declara el total (§11). Antes se formateaba como dinero
                todo lo que fuera numérico, así que «Movimientos: 1.200» —un
                conteo de filas— salía impreso como «$ 1.200» en el pie del PDF.
              */}
              <Text>
                {Number.isFinite(Number(total.valor))
                  ? formatearNumero(Number(total.valor), reporte.moneda, total.tipo)
                  : total.valor}
              </Text>
            </View>
          ))}
        </View>

        <View style={estilos.pie} fixed>
          <Text>Gestor Financiero de Proyectos Personales</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export class ReactPdfGenerador implements GeneradorPdf {
  async generar(reporte: Reporte): Promise<Uint8Array> {
    const buffer = await renderToBuffer(<DocumentoReporte reporte={reporte} />);
    return new Uint8Array(buffer);
  }
}
