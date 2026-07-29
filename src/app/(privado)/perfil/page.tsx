import type { Metadata } from "next";
import { contenedorAutenticado } from "@/di/container";
import { FormularioPerfil } from "@/modules/auth/presentation/components/formulario-perfil";

export const metadata: Metadata = { title: "Mi perfil" };

/** RF-03, RF-101. */
export default async function PaginaPerfil() {
  const { sesion } = await contenedorAutenticado();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
      <FormularioPerfil perfil={sesion.perfil} />
    </div>
  );
}
