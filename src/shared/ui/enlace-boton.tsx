import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

type Props = React.ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>;

/**
 * Enlace con apariencia de boton. Los componentes de shadcn/ui de este proyecto
 * se basan en Base UI, que compone con la prop `render` en lugar de `asChild`;
 * este helper evita repetir ese detalle en cada pantalla.
 */
export function EnlaceBoton({ className, variant, size, ...props }: Props) {
  return <Link className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
