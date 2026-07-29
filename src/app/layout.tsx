import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Proveedores } from "@/shared/ui/proveedores";

const fuenteSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fuenteMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html lang="es-CO" suppressHydrationWarning>
      <body className={`${fuenteSans.variable} ${fuenteMono.variable} antialiased`}>
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
