import { redirect } from "next/navigation";

/** El middleware ya resuelve si hay sesion; la raiz siempre lleva al panel. */
export default function Inicio() {
  redirect("/dashboard");
}
