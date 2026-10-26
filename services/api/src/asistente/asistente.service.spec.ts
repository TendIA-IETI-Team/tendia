import { AsistenteService, conGuardado } from './asistente.service';

/** Prisma y registros mínimos en memoria para probar el asistente sin base de datos. */
function montar() {
  const mensajes: { rol: string; contenido: string }[] = [];
  const prisma = {
    mensajeAsistente: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }) => {
        mensajes.push(data);
        return data;
      }),
    },
    negocio: { findUnique: jest.fn(async () => ({ nombre: 'Tienda Rosa' })) },
    solicitud: { findFirst: jest.fn(async () => null) },
  };
  const registros = {
    registrarVenta: jest.fn(async (_t: string, monto: number, _c: string, fecha?: string) => ({
      monto,
      fecha: fecha ?? '2026-10-25',
    })),
    registrarFiado: jest.fn(async (_t: string, cliente: string, monto: number) => ({
      cliente,
      monto,
    })),
    pagarFiado: jest.fn(async () => ({ pagados: 1, total: 20000 })),
    resumenTexto: jest.fn(async () => 'Hoy llevas $350.000 en ventas.'),
  };
  const svc = new AsistenteService(prisma as never, registros as never);
  return { svc, prisma, registros, mensajes };
}

describe('AsistenteService', () => {
  it('sin llave de Claude usa el intérprete y guarda la conversación', async () => {
    const { svc, registros, mensajes } = montar();
    const r = await svc.responder('t1', 'Hoy vendí 350 mil', 'app');
    expect(r.fuente).toBe('reglas');
    expect(registros.registrarVenta).toHaveBeenCalledWith('t1', 350000, 'asistente', undefined);
    expect(r.acciones[0].tipo).toBe('venta');
    expect(mensajes.map((m) => m.rol)).toEqual(['user', 'assistant']);
  });

  it('con Claude ejecuta las herramientas que el modelo pide y devuelve su texto', async () => {
    const { svc, registros } = montar();
    const toolRunner = jest.fn(
      async (params: {
        tools: { name: string; run: (i: unknown) => Promise<string> }[];
        messages: unknown[];
        system: string;
      }) => {
        // Simula al modelo: anota una venta y un fiado, luego responde.
        const tool = (n: string) => params.tools.find((t) => t.name === n)!;
        await tool('registrar_venta').run({ monto: 350000 });
        await tool('registrar_fiado').run({ cliente: 'Don Pedro', monto: 20000 });
        expect(params.system).toContain('Tienda Rosa');
        return {
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'Listo: anoté $350.000 de hoy y el fiado de Don Pedro.' },
          ],
        };
      },
    );
    Object.defineProperty(svc, 'client', { value: { beta: { messages: { toolRunner } } } });

    const r = await svc.responder('t1', 'hoy vendí 350 y le fié 20 a don pedro', 'whatsapp');
    expect(r.fuente).toBe('ia');
    expect(r.respuesta).toContain('Don Pedro');
    expect(registros.registrarVenta).toHaveBeenCalledWith('t1', 350000, 'whatsapp', undefined);
    expect(r.acciones.map((a) => a.tipo)).toEqual(['venta', 'fiado']);
  });

  it('le recuerda a Claude lo que ya guardó para que no lo anote dos veces', async () => {
    const { svc, prisma, mensajes } = montar();
    prisma.mensajeAsistente.findMany.mockResolvedValueOnce([
      {
        rol: 'assistant',
        contenido: 'Ya te anoté la venta y el fiado.',
        canal: 'app',
        creadoEn: new Date(2),
        acciones: [
          { tipo: 'venta', detalle: 'venta de $350.000 el 2026-10-25' },
          { tipo: 'fiado', detalle: 'fiado de $20.000 a Don Pedro' },
        ],
      },
      { rol: 'user', contenido: 'hoy vendí 350 mil', canal: 'app', creadoEn: new Date(1) },
    ] as never);
    let enviado: { messages: { role: string; content: string }[]; system: string } | undefined;
    const toolRunner = jest.fn(async (params: typeof enviado) => {
      enviado = params;
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Vas muy bien.' }] };
    });
    Object.defineProperty(svc, 'client', { value: { beta: { messages: { toolRunner } } } });

    await svc.responder('t1', '¿cómo voy?', 'whatsapp');
    expect(enviado!.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(enviado!.messages[1].content).toContain(
      '[Ya guardado en ese turno: venta de $350.000 el 2026-10-25; fiado de $20.000 a Don Pedro]',
    );
    expect(enviado!.system).toContain('nunca vuelvas a anotar');
    expect(enviado!.system).toContain('Hoy llevas $350.000');
    // Las consultas no se guardan como acciones.
    expect(mensajes.at(-1)).toMatchObject({ rol: 'assistant', acciones: [] });
  });

  it('una respuesta sin acciones queda igual en el historial', () => {
    expect(conGuardado({ contenido: 'Hola', acciones: [] })).toBe('Hola');
  });

  it('si Claude falla después de anotar, no repite la acción y lo cuenta', async () => {
    const { svc, registros } = montar();
    const toolRunner = jest.fn(
      async (params: { tools: { name: string; run: (i: unknown) => Promise<string> }[] }) => {
        await params.tools.find((t) => t.name === 'registrar_venta')!.run({ monto: 100000 });
        throw new Error('timeout');
      },
    );
    Object.defineProperty(svc, 'client', { value: { beta: { messages: { toolRunner } } } });
    const r = await svc.responder('t1', 'vendí 100 mil', 'app');
    expect(registros.registrarVenta).toHaveBeenCalledTimes(1);
    expect(r.respuesta).toContain('venta de $100.000');
  });

  it('las herramientas devuelven el error en texto para que el modelo lo explique', async () => {
    const { svc, registros } = montar();
    registros.registrarVenta.mockRejectedValueOnce(
      new Error('No se pueden registrar ventas de días futuros'),
    );
    const [venta] = svc.herramientas('t1', 'asistente', []);
    await expect(
      (venta as unknown as { run: (i: unknown) => Promise<string> }).run({
        monto: 1,
        fecha: '2999-01-01',
      }),
    ).resolves.toContain('días futuros');
  });

  it('cuenta el estado de la solicitud cuando no hay ninguna', async () => {
    const { svc } = montar();
    await expect(svc.solicitudTexto('t1')).resolves.toContain('Todavía no tienes una solicitud');
  });
});
