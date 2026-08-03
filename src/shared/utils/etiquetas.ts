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
// Los canales y estados de aviso viven en el dominio de su modulo y no en el
// vocabulario compartido: solo las pantallas de avisos los nombran (§10.2).
import type {
  CanalNotificacion,
  EstadoNotificacion,
} from "@/modules/notificaciones/domain/notificacion.entity";

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

/** §10.2, RF-59: la campana y el historial de avisos. */
export const ETIQUETA_CANAL_NOTIFICACION: Record<CanalNotificacion, string> = {
  email: "Correo",
  whatsapp: "WhatsApp",
  in_app: "En la app",
};

/**
 * Los cuatro estados describen el ENVÍO, no la lectura. «Programada» se dice
 * «En cola» porque para quien lee la pantalla lo relevante es que todavía no
 * salió, no el nombre interno del estado.
 */
export const ETIQUETA_ESTADO_NOTIFICACION: Record<EstadoNotificacion, string> = {
  programada: "En cola",
  enviada: "Enviada",
  fallida: "Reintentando",
  cancelada: "Cancelada",
};

/** Mensajes de error de dominio traducidos (§8.6). */
export const MENSAJE_ERROR: Record<string, string> = {
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a ingresar con el token de acceso.",
  NO_AUTORIZADO: "Tu sesión expiró. Vuelve a ingresar con el token de acceso.",
  TOKEN_INVALIDO: "El token de acceso no es correcto.",
  DEMASIADOS_INTENTOS: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.",
  PROYECTO_NO_ENCONTRADO: "El proyecto no existe.",
  PROYECTO_CERRADO: "El proyecto está finalizado o archivado y no acepta movimientos nuevos.",
  PROYECTO_CON_MOVIMIENTOS:
    "El proyecto tiene movimientos registrados: solo puede archivarse, no eliminarse.",
  CATEGORIA_NO_ENCONTRADA: "La categoría no existe.",
  // `NoEncontrado` deriva el codigo del nombre de la entidad, en masculino.
  CATEGORIA_NO_ENCONTRADO: "La categoría no existe.",
  CATEGORIA_PADRE_NO_ENCONTRADO: "La categoría padre no existe.",
  METODO_DE_PAGO_NO_ENCONTRADO: "El método de pago no existe.",
  TIPO_DE_PROYECTO_NO_ENCONTRADO: "El tipo de proyecto no existe.",
  CATEGORIA_INCOMPATIBLE:
    "La categoría no corresponde al tipo de movimiento seleccionado (ingreso o egreso).",
  CATEGORIA_DEL_SISTEMA: "Las categorías del sistema no se pueden modificar; puedes ocultarlas.",
  FILA_DE_SISTEMA_NO_MODIFICABLE:
    "Ese registro forma parte del catálogo del sistema y no se puede modificar; puedes ocultarlo.",
  FILA_DE_SISTEMA_NO_ELIMINABLE:
    "Ese registro forma parte del catálogo del sistema y no se puede eliminar; puedes ocultarlo.",
  CATEGORIA_EN_USO: "La categoría tiene movimientos asociados: desactívala en lugar de eliminarla.",
  CATEGORIA_DUPLICADA: "Ya existe una categoría con ese nombre.",
  METODO_PAGO_NO_ENCONTRADO: "El método de pago no existe.",
  METODO_PAGO_DUPLICADO: "Ya existe un método de pago con ese nombre.",
  METODO_PAGO_EN_USO: "El método de pago tiene movimientos asociados: desactívalo.",
  MOVIMIENTO_NO_ENCONTRADO: "El movimiento no existe.",
  MONEDA_INVALIDA: "Usa el código ISO de tres letras, por ejemplo COP.",
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
  EXPORTACION_DEMASIADO_GRANDE:
    "El reporte tiene más filas de las que admite una exportación. Refina los filtros.",
  OBLIGACION_NO_ENCONTRADO: "La obligación no existe.",
  OCURRENCIA_NO_ENCONTRADO: "La ocurrencia no existe.",
  OBLIGACION_CON_PAGOS:
    "La obligación tiene ocurrencias pagadas: solo puede suspenderse, no eliminarse.",
  OBLIGACION_YA_SUSPENDIDA: "La obligación ya está suspendida.",
  OCURRENCIA_YA_PAGADA: "La ocurrencia ya está pagada.",
  OCURRENCIA_OMITIDA: "La ocurrencia ya está omitida.",
  INTERVALO_INVALIDO: "Una frecuencia personalizada requiere un intervalo entre 1 y 60 meses.",
  CONCEPTO_INVALIDO: "El concepto debe tener entre 1 y 150 caracteres.",
  AVISO_NO_ENCONTRADO: "El aviso no existe.",
  AVISO_NO_LEIBLE: "Solo los avisos in-app se leen dentro de la aplicación.",
  DOCUMENTO_NO_ENCONTRADO: "El soporte no existe o ya fue eliminado.",
  TIPO_ARCHIVO_NO_PERMITIDO: "Solo se admiten PDF, JPG, PNG, WEBP, XLSX y DOCX.",
  ARCHIVO_DEMASIADO_GRANDE: "El archivo supera el máximo de 20 MB.",
  ARCHIVO_VACIO: "El archivo está vacío o no se pudo leer.",
  DEMASIADOS_SOPORTES: "Un movimiento admite máximo 7 soportes.",
  ERROR_INESPERADO: "Ocurrió un error inesperado. Intenta de nuevo.",
};

export function mensajeDeError(codigo: string, respaldo?: string): string {
  return MENSAJE_ERROR[codigo] ?? respaldo ?? MENSAJE_ERROR.ERROR_INESPERADO!;
}
