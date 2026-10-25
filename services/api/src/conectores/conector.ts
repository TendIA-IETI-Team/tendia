import type { FuenteTipo } from '@prisma/client';

/** Un mes de datos de una fuente: ventas (datáfono, open finance) o compras y pagos (distribuidor). */
export interface RegistroMensual {
  mes: string; // YYYY-MM
  ventas?: number;
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

/**
 * Interfaz común de conectores (TND-030). Cada fuente real (Bold, Treinta, Belvo, un distribuidor)
 * implementa esta interfaz; la API solo llama a las fuentes con consentimiento vigente.
 */
export interface Conector {
  readonly fuente: FuenteTipo;
  readonly proveedores: readonly string[];
  readonly simulado: boolean;
  obtenerHistorial(negocio: NegocioRef, meses: number, hasta: string): Promise<RegistroMensual[]>;
}
