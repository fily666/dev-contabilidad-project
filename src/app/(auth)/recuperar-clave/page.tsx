import type { Metadata } from "next";
import { FormularioRecuperarClave } from "@/modules/auth/presentation/components/formulario-recuperar-clave";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function PaginaRecuperarClave() {
  return <FormularioRecuperarClave />;
}
