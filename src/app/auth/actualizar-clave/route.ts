import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/shared/infrastructure/supabase/cliente-servidor";

/**
 * Callback de restablecimiento de contraseña (RF-02): valida el token de
 * recuperacion, abre la sesion y lleva al formulario de nueva contraseña.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");

  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/recuperar-clave?error=enlace_invalido`);
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/recuperar-clave?error=enlace_expirado`);
  }

  return NextResponse.redirect(`${origin}/actualizar-clave`);
}
