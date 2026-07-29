export type Perfil = {
  id: string;
  nombreCompleto: string;
  correo: string;
  moneda: string;
  zonaHoraria: string;
  tema: "light" | "dark" | "system";
};

export type Sesion = {
  usuarioId: string;
  correo: string;
  perfil: Perfil;
};

/** PUERTO de autenticacion (Contexto.md §7.3, §9). */
export interface ServicioAutenticacion {
  registrar(entrada: {
    correo: string;
    clave: string;
    nombreCompleto: string;
  }): Promise<{ requiereConfirmacion: boolean }>;
  iniciarSesion(entrada: { correo: string; clave: string }): Promise<void>;
  cerrarSesion(): Promise<void>;
  enviarCorreoRecuperacion(correo: string): Promise<void>;
  actualizarClave(clave: string): Promise<void>;
  /** Sesion vigente, o null si no hay usuario autenticado. */
  sesionActual(): Promise<Sesion | null>;
}

/** PUERTO del perfil (Contexto.md §7.3). RF-03. */
export interface PerfilRepository {
  obtener(usuarioId: string): Promise<Perfil | null>;
  actualizar(
    usuarioId: string,
    datos: Partial<Pick<Perfil, "nombreCompleto" | "moneda" | "zonaHoraria" | "tema">>,
  ): Promise<Perfil>;
}
