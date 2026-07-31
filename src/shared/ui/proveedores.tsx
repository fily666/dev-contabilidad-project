"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/shared/ui/sonner";

/**
 * Proveedores globales: tema claro/oscuro (RNF-03) y avisos (§8.6).
 *
 * Ya no monta TanStack Query. La lectura interactiva —filtros, orden y
 * paginacion— viaja en la URL y la resuelve el servidor en cada navegacion
 * (§7.6, RNF-09): es lo que hace los filtros compartibles y lo que deja al
 * cliente sin estado que sincronizar. El proveedor estaba montado sin un solo
 * consumidor, y un contenedor de cache vacio no es arquitectura, es peso.
 */
export function Proveedores({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  );
}
