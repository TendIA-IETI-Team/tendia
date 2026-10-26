import { ServiceUnavailableException } from '@nestjs/common';
import { resetConfig } from '../config';
import { OtpSender } from './otp-sender';

function respuesta(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('OtpSender', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
  const entorno = { ...process.env };

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env = { ...entorno };
    resetConfig();
  });

  afterAll(() => {
    process.env = entorno;
    resetConfig();
  });

  function conTwilio(extra: Record<string, string> = {}) {
    Object.assign(process.env, {
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'token',
      ...extra,
    });
    resetConfig();
  }

  it('sin Twilio y en modo de desarrollo muestra el código en pantalla', () => {
    expect(new OtpSender().canal('3101234567')).toBe('pantalla');
  });

  it('sin Twilio ni modo de desarrollo no hay canal', () => {
    process.env.OTP_DEV_MODE = 'false';
    resetConfig();
    expect(() => new OtpSender().canal('3101234567')).toThrow(ServiceUnavailableException);
  });

  it('con Twilio, un celular real recibe SMS y uno de demostración ve el código', () => {
    conTwilio();
    const otp = new OtpSender();
    expect(otp.hasProvider).toBe(true);
    expect(otp.canal('3101234567')).toBe('twilio');
    expect(otp.canal('3000000001')).toBe('pantalla');
    expect(otp.canal('3000000987')).toBe('pantalla'); // rango de pruebas automáticas
    expect(otp.canal('3000001000')).toBe('twilio');
  });

  it('en producción el celular de demostración también va por Twilio', () => {
    conTwilio({ APP_ENV: 'production', OTP_DEV_MODE: 'false' });
    expect(new OtpSender().canal('3000000001')).toBe('twilio');
  });

  it('no necesita TWILIO_FROM: reutiliza el servicio de Verify "TendIA" de la cuenta', async () => {
    conTwilio();
    fetchMock
      .mockResolvedValueOnce(
        respuesta(200, { services: [{ sid: 'VA-tendia', friendly_name: 'TendIA' }] }),
      )
      .mockResolvedValue(respuesta(201, { status: 'pending' }));
    const otp = new OtpSender();
    await otp.enviar('3101234567');
    await otp.enviar('3101234567');

    expect(fetchMock).toHaveBeenCalledTimes(3); // el servicio se busca una sola vez
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://verify.twilio.com/v2/Services/VA-tendia/Verifications');
    const body = new URLSearchParams(init!.body as URLSearchParams);
    expect(body.get('To')).toBe('+573101234567');
    expect(body.get('Channel')).toBe('sms');
    expect(body.get('Locale')).toBe('es');
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('AC123:token').toString('base64')}`,
    );
  });

  it('crea el servicio de Verify si la cuenta no lo tiene', async () => {
    conTwilio();
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { services: [] }))
      .mockResolvedValueOnce(respuesta(201, { sid: 'VA-nuevo' }))
      .mockResolvedValueOnce(respuesta(201, { status: 'pending' }));
    await new OtpSender().enviar('3101234567');
    expect(fetchMock.mock.calls[1][0]).toBe('https://verify.twilio.com/v2/Services');
    expect(
      new URLSearchParams(fetchMock.mock.calls[1][1]!.body as URLSearchParams).get('FriendlyName'),
    ).toBe('TendIA');
    expect(fetchMock.mock.calls[2][0]).toContain('/Services/VA-nuevo/Verifications');
  });

  it('usa TWILIO_VERIFY_SERVICE_SID cuando está configurado', async () => {
    conTwilio({ TWILIO_VERIFY_SERVICE_SID: 'VA-fijo' });
    fetchMock.mockResolvedValue(respuesta(200, { status: 'approved' }));
    await expect(new OtpSender().verificar('3101234567', '123456')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://verify.twilio.com/v2/Services/VA-fijo/VerificationCheck',
    );
  });

  it('un código errado o vencido no pasa', async () => {
    conTwilio({ TWILIO_VERIFY_SERVICE_SID: 'VA-fijo' });
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { status: 'pending' }))
      .mockResolvedValueOnce(respuesta(404, { code: 20404 }));
    const otp = new OtpSender();
    await expect(otp.verificar('3101234567', '000000')).resolves.toBe(false);
    await expect(otp.verificar('3101234567', '000000')).resolves.toBe(false);
  });

  it('si Twilio rechaza el envío (p. ej. número sin verificar en cuenta de prueba) avisa sin filtrar el detalle', async () => {
    conTwilio({ TWILIO_VERIFY_SERVICE_SID: 'VA-fijo' });
    fetchMock.mockResolvedValue(
      respuesta(400, { code: 21608, message: 'The number is unverified' }),
    );
    await expect(new OtpSender().enviar('3101234567')).rejects.toThrow(
      'No pudimos enviarte el código por SMS',
    );
  });
});
