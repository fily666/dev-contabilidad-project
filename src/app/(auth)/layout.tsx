import Link from "next/link";
import { Wallet } from "lucide-react";

export default function LayoutAutenticacion({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <Link href="/login" className="flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Wallet className="size-4" aria-hidden />
        </span>
        Gestor Financiero
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Administra la inversión, los gastos, los ingresos y las obligaciones de cada uno de tus
        proyectos.
      </p>
    </div>
  );
}
