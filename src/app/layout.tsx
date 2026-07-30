import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Proveedores } from "@/shared/ui/proveedores";

/**
 * Tres cortes tipograficos con un trabajo cada uno (ver README §Diseño):
 * texto de interfaz y cifras, titulos, y etiquetas de dato.
 *
 * Las variables se declaran en <html>, no en <body>: la regla base
 * `html { font-family: ... }` vive por encima del body y no las veria.
 */
const fuenteTexto = Inter({
  variable: "--fuente-texto",
  subsets: ["latin"],
  display: "swap",
});

const fuenteTitulos = Space_Grotesk({
  variable: "--fuente-titulos",
  subsets: ["latin"],
  display: "swap",
});

const fuenteMono = JetBrains_Mono({
  variable: "--fuente-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Gestor Financiero de Proyectos",
    template: "%s · Gestor Financiero",
  },
  description:
    "Administra la inversión, los gastos, los ingresos y las obligaciones de tus proyectos personales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CO"
      suppressHydrationWarning
      className={`${fuenteTexto.variable} ${fuenteTitulos.variable} ${fuenteMono.variable}`}
    >
      <body className="antialiased">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
