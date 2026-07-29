import type { Metadata } from "next";
import { FormularioRegistro } from "@/modules/auth/presentation/components/formulario-registro";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function PaginaRegistro() {
  return <FormularioRegistro />;
}
