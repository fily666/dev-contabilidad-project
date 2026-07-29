import { z } from "zod";

/** Esquemas compartidos por formulario y Server Action (Contexto.md §8.7). */

const correo = z
  .string()
  .min(1, "El correo es obligatorio.")
  .email("Escribe un correo electrónico válido.")
  .transform((v) => v.trim().toLowerCase());

const clave = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(72, "La contraseña no puede superar 72 caracteres.")
  .regex(/[a-z]/, "Incluye al menos una letra minúscula.")
  .regex(/[A-Z]/, "Incluye al menos una letra mayúscula.")
  .regex(/[0-9]/, "Incluye al menos un número.");

export const esquemaIniciarSesion = z.object({
  correo,
  clave: z.string().min(1, "La contraseña es obligatoria."),
});

export const esquemaRegistro = z
  .object({
    nombreCompleto: z
      .string()
      .min(3, "Escribe tu nombre completo.")
      .max(120, "El nombre es demasiado largo.")
      .transform((v) => v.trim()),
    correo,
    clave,
    confirmacion: z.string(),
  })
  .refine((d) => d.clave === d.confirmacion, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmacion"],
  });

export const esquemaRecuperarClave = z.object({ correo });

export const esquemaActualizarClave = z
  .object({ clave, confirmacion: z.string() })
  .refine((d) => d.clave === d.confirmacion, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmacion"],
  });

export const esquemaPerfil = z.object({
  nombreCompleto: z
    .string()
    .min(3, "Escribe tu nombre completo.")
    .max(120, "El nombre es demasiado largo.")
    .transform((v) => v.trim()),
  moneda: z.string().length(3, "Usa el código ISO de 3 letras, por ejemplo COP."),
  zonaHoraria: z.string().min(1, "Selecciona una zona horaria."),
  tema: z.enum(["light", "dark", "system"]),
});

export type DatosIniciarSesion = z.input<typeof esquemaIniciarSesion>;
export type DatosRegistro = z.input<typeof esquemaRegistro>;
export type DatosRecuperarClave = z.input<typeof esquemaRecuperarClave>;
export type DatosActualizarClave = z.input<typeof esquemaActualizarClave>;
export type DatosPerfil = z.input<typeof esquemaPerfil>;
