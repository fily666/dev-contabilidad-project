"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/shared/domain/enumeraciones";
import { ETIQUETA_TIPO_DOCUMENTO } from "@/shared/utils/etiquetas";
import { subirDocumentoAction } from "../actions";
import { ACCEPT_ARCHIVOS } from "../schemas";

type Props = {
  proyectoId: string;
  /** Cuando llega, el soporte queda asociado al movimiento (RF-40). */
  movimientoId?: string | null;
  etiqueta?: string;
};

/** RF-40 a RF-43. */
export function SubidaDocumento({ proyectoId, movimientoId, etiqueta = "Subir soporte" }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("otro");
  const [nombre, setNombre] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  function enviar(archivo: File) {
    const datos = new FormData();
    datos.set("proyectoId", proyectoId);
    if (movimientoId) datos.set("movimientoId", movimientoId);
    datos.set("tipoDocumento", tipoDocumento);
    datos.set("archivo", archivo);

    iniciarTransicion(async () => {
      const resultado = await subirDocumentoAction(datos);
      if (!resultado.ok) {
        toast.error(resultado.mensaje);
        return;
      }
      toast.success("Soporte cargado.");
      setNombre(null);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="panel space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`tipo-documento-${proyectoId}`}>Tipo de documento</Label>
          <Select
            value={tipoDocumento}
            onValueChange={(v) => setTipoDocumento((v ?? "otro") as TipoDocumento)}
          >
            <SelectTrigger id={`tipo-documento-${proyectoId}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_DOCUMENTO.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {ETIQUETA_TIPO_DOCUMENTO[tipo]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`archivo-${proyectoId}`}>Archivo</Label>
          <Input
            ref={entrada}
            id={`archivo-${proyectoId}`}
            type="file"
            accept={ACCEPT_ARCHIVOS}
            onChange={(e) => setNombre(e.target.files?.[0]?.name ?? null)}
            disabled={pendiente}
          />
          <p className="text-xs text-muted-foreground">
            PDF, JPG, PNG, WEBP, XLSX o DOCX. Máximo 10 MB.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm text-muted-foreground">
          {nombre ?? "Ningún archivo seleccionado"}
        </span>
        <Button
          onClick={() => {
            const archivo = entrada.current?.files?.[0];
            if (!archivo) {
              toast.error("Selecciona un archivo.");
              return;
            }
            enviar(archivo);
          }}
          disabled={pendiente || !nombre}
        >
          {pendiente ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4" aria-hidden />
          )}
          {etiqueta}
        </Button>
      </div>
    </div>
  );
}
