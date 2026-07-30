import Link from "next/link";
import { Wallet } from "lucide-react";

export default function LayoutAutenticacion({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <div aria-hidden className="fondo-tablero pointer-events-none fixed inset-0 -z-10" />

      <Link href="/acceso" className="flex flex-col items-center gap-3">
        <span className="brillo-neon flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neon/25 to-neon-2/25 text-neon">
          <Wallet className="size-6" aria-hidden />
        </span>
        <span className="text-center">
          <span className="block text-lg font-semibold tracking-tight">Gestor Financiero</span>
          <span className="etiqueta-dato block">Panel de control</span>
        </span>
      </Link>

      <div className="w-full max-w-sm">{children}</div>

      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Administra la inversión, los gastos, los ingresos y las obligaciones de cada uno de tus
        proyectos.
      </p>
    </div>
  );
}
