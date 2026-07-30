import { ControlDeIntentos } from "../domain/control-intentos";

/**
 * Instancia unica del freno a la fuerza bruta.
 *
 * Vive en infraestructura porque su estado es un detalle del proceso: la clase
 * del dominio es pura y recibe el reloj, este modulo solo decide que haya una
 * sola por instancia del servidor. En desarrollo se conserva en globalThis para
 * que la recarga en caliente de Next no reinicie la cuenta en cada cambio.
 */
const clave = Symbol.for("gestor-financiero.control-intentos");

type Contenedor = typeof globalThis & { [clave]?: ControlDeIntentos };

export function controlDeIntentos(): ControlDeIntentos {
  const contenedor = globalThis as Contenedor;
  return (contenedor[clave] ??= new ControlDeIntentos());
}
