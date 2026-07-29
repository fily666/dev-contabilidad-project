import type { Metadata } from "next";
import { FormularioActualizarClave } from "@/modules/auth/presentation/components/formulario-actualizar-clave";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function PaginaActualizarClave() {
  return <FormularioActualizarClave />;
}
