"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Menu, User } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { NavegacionLateral } from "@/shared/ui/navegacion-lateral";
import { SelectorTema } from "@/shared/ui/selector-tema";
import { cerrarSesionAction } from "@/modules/auth/presentation/actions";

type Props = { nombre: string; correo: string };

export function BarraSuperior({ nombre, correo }: Props) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const iniciales = nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

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

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-2" />}>
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {iniciales || <User className="size-4" aria-hidden />}
            </span>
            <span className="hidden max-w-32 truncate text-sm sm:inline">{nombre}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{nombre}</p>
              <p className="truncate text-xs text-muted-foreground">{correo}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/perfil" />}>
              <User className="size-4" aria-hidden /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void cerrarSesionAction();
              }}
            >
              <LogOut className="size-4" aria-hidden /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
