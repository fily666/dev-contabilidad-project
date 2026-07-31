"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { formatearTamano } from "@/shared/utils/formato";
import {
  MAXIMO_SOPORTES_POR_MOVIMIENTO,
  MIMES_COMPROBANTE,
  TAMANO_MAXIMO_BYTES,
  TAMANO_MAXIMO_LEGIBLE,
} from "@/modules/documentos/domain/documento.entity";
import { ACCEPT_COMPROBANTES } from "@/modules/documentos/presentation/schemas";

type Props = {
  archivos: File[];
  alCambiar: (archivos: File[]) => void;
  deshabilitado?: boolean;
};

/**
 * RF-40: soportes del pago elegidos antes de registrar el movimiento.
 *
 * No sube nada: solo acumula los `File` en el estado del formulario, porque el
 * soporte necesita el id del movimiento y ese id no existe hasta que la Server
 * Action responde. Las mismas tres reglas del servidor —tipo, tamaño y numero—
 * se comprueban aqui para avisar en el acto y no despues de guardar (§8.7).
 */
export function AdjuntosMovimiento({ archivos, alCambiar, deshabilitado }: Props) {
  const [avisos, setAvisos] = useState<string[]>([]);
  const entrada = useRef<HTMLInputElement>(null);
  const restantes = MAXIMO_SOPORTES_POR_MOVIMIENTO - archivos.length;

  function agregar(seleccionados: File[]) {
    const problemas: string[] = [];
    const aceptados = [...archivos];

    for (const archivo of seleccionados) {
      if (aceptados.length >= MAXIMO_SOPORTES_POR_MOVIMIENTO) {
        problemas.push(
          `«${archivo.name}» quedó fuera: máximo ${MAXIMO_SOPORTES_POR_MOVIMIENTO} archivos.`,
        );
      } else if (!MIMES_COMPROBANTE.includes(archivo.type)) {
        problemas.push(`«${archivo.name}» no es un PDF ni una imagen.`);
      } else if (archivo.size === 0) {
        problemas.push(`«${archivo.name}» está vacío.`);
      } else if (archivo.size > TAMANO_MAXIMO_BYTES) {
        problemas.push(
          `«${archivo.name}» pesa ${formatearTamano(archivo.size)} y el máximo es ${TAMANO_MAXIMO_LEGIBLE}.`,
        );
      } else if (aceptados.some((a) => a.name === archivo.name && a.size === archivo.size)) {
        problemas.push(`«${archivo.name}» ya estaba en la lista.`);
      } else {
        aceptados.push(archivo);
      }
    }

    setAvisos(problemas);
    alCambiar(aceptados);
    // Se limpia el input para que volver a elegir el mismo archivo —tras
    // quitarlo de la lista— dispare otro `change`.
    if (entrada.current) entrada.current.value = "";
  }

  function quitar(indice: number) {
    setAvisos([]);
    alCambiar(archivos.filter((_, i) => i !== indice));
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="soportes">Soportes del pago</Label>
      <Input
        ref={entrada}
        id="soportes"
        type="file"
        multiple
        accept={ACCEPT_COMPROBANTES}
        disabled={deshabilitado || restantes === 0}
        onChange={(e) => agregar([...(e.target.files ?? [])])}
      />
      <p className="text-xs text-muted-foreground">
        Opcional. PDF, JPG, PNG o WEBP. Hasta {MAXIMO_SOPORTES_POR_MOVIMIENTO} archivos de{" "}
        {TAMANO_MAXIMO_LEGIBLE} cada uno.{" "}
        {restantes === 0 ? "Ya alcanzaste el máximo." : `Puedes añadir ${restantes} más.`}
      </p>

      {avisos.length > 0 ? (
        <ul className="space-y-1">
          {avisos.map((aviso) => (
            <li key={aviso} className="text-sm text-destructive">
              {aviso}
            </li>
          ))}
        </ul>
      ) : null}

      {archivos.length > 0 ? (
        <ul className="space-y-1" aria-label="Soportes seleccionados">
          {archivos.map((archivo, indice) => (
            <li
              key={`${archivo.name}-${archivo.size}`}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              {archivo.type.startsWith("image/") ? (
                <ImageIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="truncate">{archivo.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatearTamano(archivo.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar ${archivo.name}`}
                disabled={deshabilitado}
                onClick={() => quitar(indice)}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Paperclip className="size-4" aria-hidden /> Ningún soporte seleccionado.
        </p>
      )}
    </div>
  );
}
