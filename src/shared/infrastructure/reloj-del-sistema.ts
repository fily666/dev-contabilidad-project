import { type FechaIso, type Reloj } from "@/shared/domain/reloj";

/**
 * Adaptador del puerto Reloj (§7.3). La fecha de negocio se calcula en la zona
 * horaria del perfil (por defecto America/Bogota, §8.5), no en UTC: en Colombia
 * son cinco horas de diferencia y a fin de mes eso cambia el mes contable.
 */
export class RelojDelSistema implements Reloj {
  constructor(private readonly zonaHoraria = "America/Bogota") {}

  ahora(): Date {
    return new Date();
  }

  hoy(): FechaIso {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: this.zonaHoraria,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(this.ahora());
  }
}
