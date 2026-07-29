import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/shared/infrastructure/supabase/cliente-servidor";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Callback de confirmacion de correo y de enlaces mágicos de Supabase Auth.
 * Intercambia el token por una sesion y redirige (Contexto.md §9).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = searchParams.get("next") ?? "/dashboard";

  if (!tokenHash || !tipo) {
    return NextResponse.redirect(`${origin}/login?error=enlace_invalido`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=enlace_expirado`);
  }

  return NextResponse.redirect(`${origin}${destino}`);
}
