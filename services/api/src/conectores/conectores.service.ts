import { Injectable } from '@nestjs/common';
import { FuenteTipo } from '@prisma/client';
import type { Conector, NegocioRef, RegistroMensual } from './conector';
import { simularNegocio } from './simulacion';

/** Datáfono simulado (TND-030): ventas mensuales con tarjeta y QR. */
export class DatafonoSimulado implements Conector {
  readonly fuente = FuenteTipo.DATAFONO;
  readonly proveedores = ['Bold', 'Treinta', 'Chiper', 'Vendty'] as const;
  readonly simulado = true;

  async obtenerHistorial(n: NegocioRef, meses: number, hasta: string): Promise<RegistroMensual[]> {
    return simularNegocio(n, meses, hasta).map(({ mes, ventas }) => ({ mes, ventas }));
  }
}

/** Distribuidor simulado (TND-031): compras a crédito y puntualidad de pago. Resuelve el cold start. */
export class DistribuidorSimulado implements Conector {
  readonly fuente = FuenteTipo.DISTRIBUIDOR;
  readonly proveedores = ['Distribuidor mayorista (simulado)'] as const;
  readonly simulado = true;

  async obtenerHistorial(n: NegocioRef, meses: number, hasta: string): Promise<RegistroMensual[]> {
    // El distribuidor conoce un mes menos de historia en negocios nuevos (empezó a venderles después).
    const data = simularNegocio(n, meses, hasta);
    const visibles = data.length < 6 ? data.slice(1) : data;
    return visibles.map(
      ({ mes, compras, facturas, pagadasATiempo, diasRetrasoPromedio, pagado, cupo }) => ({
        mes,
        compras,
        facturas,
        pagadasATiempo,
        diasRetrasoPromedio,
        pagado: pagado ?? undefined,
        cupo,
      }),
    );
  }
}

/** Open Finance simulado (TND-032): ingresos a cuentas bancarias, como respondería un sandbox. */
export class OpenFinanceSimulado implements Conector {
  readonly fuente = FuenteTipo.OPEN_FINANCE;
  readonly proveedores = ['Cuenta bancaria (sandbox)'] as const;
  readonly simulado = true;

  async obtenerHistorial(n: NegocioRef, meses: number, hasta: string): Promise<RegistroMensual[]> {
    return simularNegocio(n, meses, hasta).map(({ mes, ventas }) => ({
      mes,
      ventas: Math.round((ventas * 0.93) / 1000) * 1000,
    }));
  }
}

@Injectable()
export class ConectoresService {
  private readonly conectores: Conector[] = [
    new DatafonoSimulado(),
    new DistribuidorSimulado(),
    new OpenFinanceSimulado(),
  ];

  porFuente(fuente: FuenteTipo): Conector | undefined {
    return this.conectores.find((c) => c.fuente === fuente);
  }

  catalogo() {
    return this.conectores.map((c) => ({
      fuente: c.fuente,
      proveedores: c.proveedores,
      simulado: c.simulado,
    }));
  }
}
