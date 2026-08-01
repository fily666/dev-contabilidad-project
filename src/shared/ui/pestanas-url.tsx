"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Tabs } from "@/shared/ui/tabs";

type Props = {
  /** Nombre del parámetro en la URL. */
  parametro?: string;
  /** Pestaña activa cuando el parámetro no viene o no se reconoce. */
  porOmision: string;
  /** Valores admitidos: una URL manipulada a mano no debe dejar la vista en blanco. */
  valores: readonly string[];
  children: React.ReactNode;
};

/**
 * Pestañas cuya selección vive en la URL, como el resto del estado de lectura
 * (§7.6).
 *
 * `Tabs` de Base UI guarda la pestaña activa en estado del cliente, así que se
 * perdía en cada recarga y siempre volvía a la primera. Con el valor en la URL, la
 * pestaña sobrevive a un refresco y se puede enlazar directamente —Configuración
 * tiene cinco secciones y «Datos» es la que uno quiere mandar por enlace—.
 *
 * Se usa `replace` y no `push`: cambiar de pestaña no es navegar, y con `push`
 * cinco clics dejaban cinco entradas en el historial y el botón «atrás» dejaba de
 * salir de la pantalla.
 */
export function PestanasEnUrl({ parametro = "seccion", porOmision, valores, children }: Props) {
  const router = useRouter();
  const parametros = useSearchParams();

  const pedido = parametros.get(parametro);
  const valor = pedido && valores.includes(pedido) ? pedido : porOmision;

  function cambiar(nuevo: string) {
    const nuevos = new URLSearchParams(parametros.toString());
    if (nuevo === porOmision) nuevos.delete(parametro);
    else nuevos.set(parametro, nuevo);
    const consulta = nuevos.toString();
    router.replace(consulta ? `?${consulta}` : "?", { scroll: false });
  }

  return (
    <Tabs value={valor} onValueChange={(nuevo) => cambiar(String(nuevo))}>
      {children}
    </Tabs>
  );
}
