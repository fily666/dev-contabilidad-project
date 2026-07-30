"use client";

import { useState } from "react";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { NavegacionLateral } from "@/shared/ui/navegacion-lateral";
import { SelectorTema } from "@/shared/ui/selector-tema";
import { salirAction } from "@/modules/acceso/presentation/actions";

/**
 * Sin menu de usuario: el sistema es monousuario (ADR-14), asi que no hay nombre
 * ni correo que mostrar. Queda el tema y la salida.
 */
export function BarraSuperior() {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-6">
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú" />
          }
        >
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <NavegacionLateral alNavegar={() => setMenuAbierto(false)} />
        </SheetContent>
      </Sheet>

      <div className="ml-auto flex items-center gap-1">
        <SelectorTema />

        <form action={salirAction}>
          <Button type="submit" variant="ghost" className="gap-2">
            <LogOut className="size-4" aria-hidden />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
