/**
 * Freno a la fuerza bruta sobre el token de acceso (Contexto.md §9).
 *
 * El token es una sola cadena y es la unica barrera del sistema, asi que
 * conviene que no se pueda probar sin limite. Tras `maximoFallos` intentos
 * fallidos desde el mismo origen, el acceso queda bloqueado `bloqueoSegundos`.
 *
 * Limitacion conocida y asumida: el estado vive en memoria del proceso. En
 * Vercel cada instancia serverless lleva su propia cuenta, asi que el freno
 * es efectivo contra un script tonto y solo parcial contra un atacante que
 * fuerce el reparto entre instancias. Es una molestia deliberada, no un muro;
 * el muro es la entropia del token.
 */
export class ControlDeIntentos {
  private readonly registro = new Map<string, { fallos: number; bloqueadoHasta: number }>();

  constructor(
    private readonly maximoFallos = 5,
    private readonly bloqueoSegundos = 300,
  ) {}

  /** Segundos que faltan para poder reintentar; 0 si no hay bloqueo. */
  segundosDeBloqueo(origen: string, ahoraEnSegundos: number): number {
    const estado = this.registro.get(origen);
    if (!estado) return 0;

    if (estado.bloqueadoHasta > ahoraEnSegundos) {
      return estado.bloqueadoHasta - ahoraEnSegundos;
    }

    // El bloqueo expiro: se olvida el historial y se vuelve a empezar.
    if (estado.bloqueadoHasta !== 0) this.registro.delete(origen);
    return 0;
  }

  registrarFallo(origen: string, ahoraEnSegundos: number): void {
    const estado = this.registro.get(origen) ?? { fallos: 0, bloqueadoHasta: 0 };
    estado.fallos += 1;

    if (estado.fallos >= this.maximoFallos) {
      estado.bloqueadoHasta = ahoraEnSegundos + this.bloqueoSegundos;
      estado.fallos = 0;
    }

    this.registro.set(origen, estado);
  }

  /** Un acierto borra el historial del origen. */
  limpiar(origen: string): void {
    this.registro.delete(origen);
  }
}
