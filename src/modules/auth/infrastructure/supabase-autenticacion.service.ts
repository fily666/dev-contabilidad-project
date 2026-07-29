import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/shared/infrastructure/supabase/database.types";
import { ErrorDeDominio } from "@/shared/domain/errores";
import type { Perfil, PerfilRepository, Sesion, ServicioAutenticacion } from "../domain/sesion";

/** Traduce los errores de Supabase Auth a codigos de dominio (§8.6). */
function traducir(mensaje: string): ErrorDeDominio {
  const m = mensaje.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return new ErrorDeDominio(
      "CREDENCIALES_INVALIDAS",
      "El correo o la contraseña son incorrectos.",
    );
  }
  if (m.includes("email not confirmed")) {
    return new ErrorDeDominio(
      "CORREO_NO_CONFIRMADO",
      "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.",
    );
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return new ErrorDeDominio("CORREO_YA_REGISTRADO", "Ya existe una cuenta con ese correo.");
  }
  if (m.includes("password") && m.includes("least")) {
    return new ErrorDeDominio("CLAVE_DEBIL", "La contraseña no cumple los requisitos mínimos.");
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return new ErrorDeDominio(
      "DEMASIADOS_INTENTOS",
      "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    );
  }
  return new ErrorDeDominio("ERROR_AUTENTICACION", "No fue posible completar la operación.");
}

/** ADAPTADOR de ServicioAutenticacion sobre Supabase Auth (§9). */
export class SupabaseAutenticacionService implements ServicioAutenticacion {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly urlAplicacion: string,
  ) {}

  async registrar(entrada: {
    correo: string;
    clave: string;
    nombreCompleto: string;
  }): Promise<{ requiereConfirmacion: boolean }> {
    const { data, error } = await this.supabase.auth.signUp({
      email: entrada.correo,
      password: entrada.clave,
      options: {
        // El trigger crear_perfil_al_registrarse lee estos metadatos (§6.6).
        data: { nombre_completo: entrada.nombreCompleto },
        emailRedirectTo: `${this.urlAplicacion}/auth/confirmar`,
      },
    });

    if (error) throw traducir(error.message);
    return { requiereConfirmacion: data.session === null };
  }

  async iniciarSesion(entrada: { correo: string; clave: string }): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email: entrada.correo,
      password: entrada.clave,
    });
    if (error) throw traducir(error.message);
  }

  async cerrarSesion(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw traducir(error.message);
  }

  async enviarCorreoRecuperacion(correo: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${this.urlAplicacion}/auth/actualizar-clave`,
    });
    if (error) throw traducir(error.message);
  }

  async actualizarClave(clave: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password: clave });
    if (error) throw traducir(error.message);
  }

  async sesionActual(): Promise<Sesion | null> {
    // getUser() valida el token contra el servidor de Auth (§9).
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return null;

    const { data: perfil } = await this.supabase
      .from("perfiles")
      .select("nombre_completo, moneda, zona_horaria, tema")
      .eq("id", user.id)
      .maybeSingle();

    const correo = user.email ?? "";

    return {
      usuarioId: user.id,
      correo,
      perfil: {
        id: user.id,
        correo,
        nombreCompleto: perfil?.nombre_completo ?? correo.split("@")[0] ?? "Usuario",
        moneda: perfil?.moneda ?? "COP",
        zonaHoraria: perfil?.zona_horaria ?? "America/Bogota",
        tema: (perfil?.tema as Perfil["tema"]) ?? "system",
      },
    };
  }
}

/** ADAPTADOR de PerfilRepository (§7.3). */
export class SupabasePerfilRepository implements PerfilRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async obtener(usuarioId: string): Promise<Perfil | null> {
    const { data, error } = await this.supabase
      .from("perfiles")
      .select("id, nombre_completo, moneda, zona_horaria, tema")
      .eq("id", usuarioId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    return {
      id: data.id,
      correo: user?.email ?? "",
      nombreCompleto: data.nombre_completo,
      moneda: data.moneda,
      zonaHoraria: data.zona_horaria,
      tema: data.tema as Perfil["tema"],
    };
  }

  async actualizar(
    usuarioId: string,
    datos: Partial<Pick<Perfil, "nombreCompleto" | "moneda" | "zonaHoraria" | "tema">>,
  ): Promise<Perfil> {
    const { data, error } = await this.supabase
      .from("perfiles")
      .update({
        ...(datos.nombreCompleto === undefined ? {} : { nombre_completo: datos.nombreCompleto }),
        ...(datos.moneda === undefined ? {} : { moneda: datos.moneda }),
        ...(datos.zonaHoraria === undefined ? {} : { zona_horaria: datos.zonaHoraria }),
        ...(datos.tema === undefined ? {} : { tema: datos.tema }),
      })
      .eq("id", usuarioId)
      .select("id, nombre_completo, moneda, zona_horaria, tema")
      .single();

    if (error) throw error;

    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    return {
      id: data.id,
      correo: user?.email ?? "",
      nombreCompleto: data.nombre_completo,
      moneda: data.moneda,
      zonaHoraria: data.zona_horaria,
      tema: data.tema as Perfil["tema"],
    };
  }
}
