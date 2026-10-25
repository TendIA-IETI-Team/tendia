import { DatafonoSimulado, DistribuidorSimulado, OpenFinanceSimulado } from './conectores.service';
import { lastClosedMonth, monthAdd, perfilDe, simularNegocio } from './simulacion';

describe('conectores simulados', () => {
  const negocio = { id: 'neg-1', perfilSimulado: null };

  it('son determinísticos por negocio', () => {
    expect(simularNegocio(negocio, 12, '2026-09')).toEqual(simularNegocio(negocio, 12, '2026-09'));
    expect(simularNegocio({ id: 'neg-2', perfilSimulado: null }, 12, '2026-09')).not.toEqual(
      simularNegocio(negocio, 12, '2026-09'),
    );
  });

  it('respetan los perfiles de demostración', () => {
    expect(perfilDe({ id: 'x', perfilSimulado: 'bueno' }).calidad).toBeGreaterThan(1);
    expect(simularNegocio({ id: 'x', perfilSimulado: 'nuevo' }, 12, '2026-09')).toHaveLength(4);
    const estacional = simularNegocio({ id: 'x', perfilSimulado: 'estacional' }, 12, '2026-09');
    const enero = estacional.find((m) => m.mes === '2026-01')!;
    const febrero = estacional.find((m) => m.mes === '2026-02')!;
    expect(enero.ventas).toBeLessThan(febrero.ventas * 0.7);
  });

  it('cada conector expone solo los datos de su fuente', async () => {
    const d = await new DatafonoSimulado().recolectar(negocio, 12, '2026-09');
    expect(Object.keys(d[0]).sort()).toEqual(['mes', 'transacciones', 'ventas']);
    expect(d[0].ventas! / d[0].transacciones!).toBeGreaterThan(6_000); // ticket de tienda
    const dist = await new DistribuidorSimulado().recolectar(negocio, 12, '2026-09');
    expect(dist[0].pagadasATiempo).toBeLessThanOrEqual(dist[0].facturas!);
    expect(dist[0]).not.toHaveProperty('ventas');
    const of = await new OpenFinanceSimulado().recolectar(negocio, 12, '2026-09');
    expect(of).toHaveLength(12);
  });

  it('el distribuidor ve menos historia en negocios nuevos', async () => {
    const nuevo = { id: 'n', perfilSimulado: 'nuevo' };
    expect(await new DistribuidorSimulado().recolectar(nuevo, 12, '2026-09')).toHaveLength(3);
  });

  it('calcula meses', () => {
    expect(monthAdd('2026-01', -1)).toBe('2025-12');
    expect(lastClosedMonth(new Date('2026-10-23T12:00:00Z'))).toBe('2026-09');
  });

  it('cada conector autoriza y reporta su estado con la misma interfaz (TND-030)', async () => {
    for (const c of [
      new DatafonoSimulado(),
      new DistribuidorSimulado(),
      new OpenFinanceSimulado(),
    ]) {
      const { referencia } = await c.autorizar(negocio, c.proveedores[0]);
      expect(referencia).toMatch(new RegExp(`^sim-${c.fuente.toLowerCase()}-`));
      expect(await c.estado()).toMatchObject({ disponible: true, simulado: true });
    }
  });
});
