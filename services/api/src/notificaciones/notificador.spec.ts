import { encrypt } from '../common/crypto';
import { resetConfig } from '../config';
import { mensajeDeEstado, NotificadorService } from './notificador.service';

const base = {
  monto: 3_000_000,
  plazoMeses: 6,
  montoAprobado: null,
  plazoAprobado: 8,
  tasaAprobada: 52.5,
  aliado: { nombre: 'Banco Demo Popular' },
};

describe('NotificadorService', () => {
  const entorno = { ...process.env };
  const fetchMock = jest.fn(async () => new Response('{}', { status: 201 }));

  beforeEach(() => {
    fetchMock.mockClear();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env = { ...entorno };
    resetConfig();
  });

  afterAll(() => {
    process.env = entorno;
    resetConfig();
  });

  function servicio(celular: string, estado = 'APROBADA') {
    const prisma = {
      solicitud: {
        findUnique: jest.fn(async () => ({
          ...base,
          estado,
          tendero: { celularCifrado: encrypt(celular) },
        })),
      },
    };
    return new NotificadorService(prisma as never);
  }

  it('arma el mensaje de cada decisión con las condiciones aprobadas', () => {
    expect(mensajeDeEstado({ ...base, estado: 'APROBADA' })).toBe(
      'TendIA: ¡Banco Demo Popular aprobó tu crédito! $3.000.000 a 8 meses, tasa 52,5 % E.A. Abre la app TendIA para ver el detalle.',
    );
    expect(mensajeDeEstado({ ...base, estado: 'RECHAZADA' })).toContain('cómo mejorar');
    expect(mensajeDeEstado({ ...base, estado: 'GARANTIA_SOLICITADA' })).toContain('garantía');
    expect(mensajeDeEstado({ ...base, estado: 'ENVIADA' })).toBeNull();
  });

  it('sin Twilio el aviso queda solo en la app', async () => {
    await servicio('3101234567').cambioDeEstado('s1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con Twilio envía por WhatsApp desde el sandbox, salvo a celulares de demostración', async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't' });
    resetConfig();
    await servicio('3000000001').cambioDeEstado('s1');
    expect(fetchMock).not.toHaveBeenCalled();

    await servicio('3101234567').cambioDeEstado('s1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/Accounts/AC1/Messages.json');
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get('From')).toBe('whatsapp:+14155238886');
    expect(body.get('To')).toBe('whatsapp:+573101234567');
  });

  it('un fallo de Twilio no tumba la decisión', async () => {
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't' });
    resetConfig();
    fetchMock.mockResolvedValueOnce(new Response('{"code":63015}', { status: 400 }));
    await expect(servicio('3101234567').cambioDeEstado('s1')).resolves.toBeUndefined();
  });
});
