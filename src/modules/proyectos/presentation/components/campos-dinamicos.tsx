"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import type { DefinicionAtributo } from "../../domain/tipo-proyecto.entity";

type Props = {
  atributos: DefinicionAtributo[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errores: FieldErrors<any>;
  valores?: Record<string, unknown>;
  alCambiarBooleano?: (clave: string, valor: boolean) => void;
};

/**
 * Renderiza los atributos declarados por el tipo de proyecto (Contexto.md §13).
 * Agregar un tipo nuevo no requiere tocar este componente.
 */
export function CamposDinamicos({
  atributos,
  register,
  errores,
  valores,
  alCambiarBooleano,
}: Props) {
  if (atributos.length === 0) return null;

  return (
    <fieldset className="grid gap-4 sm:grid-cols-2">
      <legend className="col-span-full text-sm font-medium text-muted-foreground">
        Datos específicos del tipo de proyecto
      </legend>

      {atributos.map((atributo) => {
        const nombre = `atributos.${atributo.clave}`;
        const error = (errores.atributos as Record<string, { message?: string }> | undefined)?.[
          atributo.clave
        ];

        if (atributo.tipo === "boolean") {
          return (
            <div key={atributo.clave} className="flex items-center gap-2 sm:col-span-1">
              <Checkbox
                id={nombre}
                defaultChecked={valores?.[atributo.clave] === true}
                onCheckedChange={(marcado) => alCambiarBooleano?.(atributo.clave, marcado === true)}
              />
              <Label htmlFor={nombre}>
                {atributo.etiqueta}
                {atributo.requerido ? <span aria-hidden> *</span> : null}
              </Label>
            </div>
          );
        }

        return (
          <div key={atributo.clave} className="space-y-2">
            <Label htmlFor={nombre}>
              {atributo.etiqueta}
              {atributo.requerido ? (
                <span className="text-destructive" aria-label="obligatorio">
                  {" "}
                  *
                </span>
              ) : null}
            </Label>
            <Input
              id={nombre}
              type={
                atributo.tipo === "number" ? "number" : atributo.tipo === "date" ? "date" : "text"
              }
              inputMode={atributo.tipo === "number" ? "numeric" : undefined}
              aria-invalid={!!error}
              {...register(nombre)}
            />
            {error?.message ? <p className="text-sm text-destructive">{error.message}</p> : null}
          </div>
        );
      })}
    </fieldset>
  );
}
