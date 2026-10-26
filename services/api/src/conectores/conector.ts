import type { FuenteTipo } from '@prisma/client';

/** Un mes de datos de una fuente: ventas (datáfono, open finance) o compras y pagos (distribuidor). */
export interface RegistroMensual {
  mes: string; // YYYY-MM
  ventas?: number;
  transacciones?: number; // número de ventas del mes (datáfono)
  compras?: number;
  facturas?: number;
  pagadasATiempo?: number;
  diasRetrasoPromedio?: number;
  pagado?: number; // lo pagado al proveedor ese mes
  cupo?: number; // cupo de crédito con el proveedor
}

export interface NegocioRef {
  id: string;
  perfilSimulado: string | null;
}

export interface EstadoConector {
  disponible: boolean;
  simulado: boolean;
  mensaje: string;
}

/**
 * Interfaz común de conectores (TND-030). Cada fuente real (Bold, Treinta, Belvo, un distribuidor)
 * implementa estas tres operaciones; la API solo llama a las fuentes con consentimiento vigente y
 * el motor de scoring nunca sabe de qué proveedor vino el dato.
 */
export interface Conector {
  readonly fuente: FuenteTipo;
  readonly proveedores: readonly string[];
  readonly simulado: boolean;
  /** Abre el acceso de solo lectura tras el consentimiento (en una integración real, OAuth). */
  autorizar(negocio: NegocioRef, proveedor: string): Promise<{ referencia: string }>;
  /** Trae el historial mensual hasta el mes `hasta` (YYYY-MM). */
  recolectar(negocio: NegocioRef, meses: number, hasta: string): Promise<RegistroMensual[]>;
  /** Si la fuente responde. */
  estado(): Promise<EstadoConector>;
}
