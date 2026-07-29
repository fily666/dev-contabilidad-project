import type {
  EstadoMovimiento,
  EstadoOcurrencia,
  EstadoProyecto,
  Frecuencia,
  Naturaleza,
  TipoDocumento,
  TipoMetodoPago,
  TipoMovimiento,
} from "@/shared/domain/enumeraciones";

/** Etiquetas de presentacion en es-CO (RNF-13). */

export const ETIQUETA_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  activo: "Activo",
  pausado: "Pausado",
  finalizado: "Finalizado",
  archivado: "Archivado",
};

export const ETIQUETA_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export const ETIQUETA_NATURALEZA: Record<Naturaleza, string> = {
  capex: "Inversión",
  opex: "Gasto operativo",
  financiacion: "Financiación",
  ingreso: "Ingreso",
};

export const DESCRIPCION_NATURALEZA: Record<Naturaleza, string> = {
  capex: "Capitaliza: suma al total invertido en el proyecto.",
  opex: "Gasto de sostenimiento: no incrementa la inversión.",
  financiacion: "Deuda: desembolsos y cuotas de crédito.",
  ingreso: "Entrada de dinero generada por el proyecto.",
};

export const ETIQUETA_ESTADO_MOVIMIENTO: Record<EstadoMovimiento, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  vencido: "Vencido",
  anulado: "Anulado",
};

export const ETIQUETA_ESTADO_OCURRENCIA: Record<EstadoOcurrencia, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
  omitida: "Omitida",
};

export const ETIQUETA_FRECUENCIA: Record<Frecuencia, string> = {
  unica: "Única",
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  personalizada: "Personalizada",
};

export const ETIQUETA_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  factura: "Factura",
  recibo: "Recibo",
  comprobante: "Comprobante",
  contrato: "Contrato",
  escritura: "Escritura",
  fotografia: "Fotografía",
  poliza: "Póliza",
  otro: "Otro",
};

export const ETIQUETA_TIPO_METODO_PAGO: Record<TipoMetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta_credito: "Tarjeta de crédito",
  tarjeta_debito: "Tarjeta débito",
  debito_automatico: "Débito automático",
  otro: "Otro",
};

/** Mensajes de error de dominio traducidos (§8.6). */
export const MENSAJE_ERROR: Record<string, string> = {
  NO_AUTENTICADO: "Tu sesión expiró. Inicia sesión de nuevo.",
  NO_AUTORIZADO: "No tienes permiso sobre este registro.",
  PROYECTO_NO_ENCONTRADO: "El proyecto no existe o no te pertenece.",
  PROYECTO_CERRADO: "El proyecto está finalizado o archivado y no acepta movimientos nuevos.",
  PROYECTO_CON_MOVIMIENTOS:
    "El proyecto tiene movimientos registrados: solo puede archivarse, no eliminarse.",
  PROYECTO_DE_OTRO_PROPIETARIO: "El proyecto no te pertenece.",
  CATEGORIA_NO_ENCONTRADA: "La categoría no existe o no te pertenece.",
  CATEGORIA_INCOMPATIBLE:
    "La categoría no corresponde al tipo de movimiento seleccionado (ingreso o egreso).",
  CATEGORIA_DEL_SISTEMA: "Las categorías del sistema no se pueden modificar; puedes ocultarlas.",
  CATEGORIA_EN_USO: "La categoría tiene movimientos asociados: desactívala en lugar de eliminarla.",
  CATEGORIA_DUPLICADA: "Ya existe una categoría con ese nombre.",
  METODO_PAGO_NO_ENCONTRADO: "El método de pago no existe o no te pertenece.",
  METODO_PAGO_DUPLICADO: "Ya tienes un método de pago con ese nombre.",
  METODO_PAGO_EN_USO: "El método de pago tiene movimientos asociados: desactívalo.",
  MOVIMIENTO_NO_ENCONTRADO: "El movimiento no existe o no te pertenece.",
  MOVIMIENTO_ANULADO: "El movimiento está anulado y no admite cambios.",
  MOVIMIENTO_YA_PAGADO: "El movimiento ya está registrado como pagado.",
  MONTO_INVALIDO: "El valor ingresado no es un importe válido.",
  MONEDA_INCOMPATIBLE: "La moneda del movimiento debe ser la misma del proyecto.",
  VALOR_NO_POSITIVO: "El valor debe ser mayor que cero.",
  FECHA_INVALIDA: "La fecha no es válida.",
  FECHAS_INCOHERENTES: "La fecha de cierre no puede ser anterior a la fecha de inicio.",
  ATRIBUTO_REQUERIDO: "Faltan atributos obligatorios del tipo de proyecto.",
  TIPO_PROYECTO_NO_ENCONTRADO: "El tipo de proyecto no existe.",
  DATOS_INVALIDOS: "Revisa los datos del formulario.",
  ERROR_INESPERADO: "Ocurrió un error inesperado. Intenta de nuevo.",
};

export function mensajeDeError(codigo: string, respaldo?: string): string {
  return MENSAJE_ERROR[codigo] ?? respaldo ?? MENSAJE_ERROR.ERROR_INESPERADO!;
}
