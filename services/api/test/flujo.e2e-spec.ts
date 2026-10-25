import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { lastClosedMonth, monthAdd } from '../src/conectores/simulacion';
import { resetMfa } from '../src/scripts/reset-mfa';
import { bearer, createApp, loginAliado, loginTendero } from './helpers';

describe('Flujo completo tendero → score → aliado (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function prepararTendero(celular: string) {
    const token = await loginTendero(app, celular);
    await request(http)
      .put('/me/negocio')
      .set(bearer(token))
      .send({
        nombre: 'Tienda La Esquina',
        nombrePropietario: 'Gloria',
        antiguedadMeses: 48,
        barrio: 'Kennedy',
      })
      .expect(200);
    await request(http)
      .post('/consentimientos')
      .set(bearer(token))
      .send({ fuente: 'DATAFONO', proveedor: 'Bold' })
      .expect(201);
    await request(http)
      .post('/consentimientos')
      .set(bearer(token))
      .send({ fuente: 'DISTRIBUIDOR', proveedor: 'Distribuidor mayorista (simulado)' })
      .expect(201);
    const sol = await request(http)
      .post('/solicitudes')
      .set(bearer(token))
      .send({ monto: 3_000_000, destino: 'Surtir para diciembre', plazoMeses: 6 })
      .expect(201);
    return { token, solicitudId: sol.body.id as string };
  }

  it('rechaza celulares inválidos y exige token', async () => {
    await request(http).post('/auth/tendero/otp').send({ celular: '12345' }).expect(400);
    await request(http).get('/me').expect(401);
    await request(http).get('/health').expect(200);
  });

  it('un código OTP errado no da acceso', async () => {
    await request(http).post('/auth/tendero/otp').send({ celular: '3109998877' }).expect(200);
    await request(http)
      .post('/auth/tendero/verificar')
      .send({ celular: '3109998877', codigo: '000000' })
      .expect(401);
  });

  it('recorre T1 → T13 con variación justificada, garantía y decisión del aliado', async () => {
    const { token, solicitudId } = await prepararTendero('3000000002'); // perfil estacional

    const evaluada = await request(http)
      .post(`/solicitudes/${solicitudId}/evaluar`)
      .set(bearer(token))
      .expect(200);
    expect(evaluada.body.estado).toBe('SCORE_LISTO');
    const s = evaluada.body.score;
    expect(s.puntaje).toBeGreaterThanOrEqual(0);
    expect(s.puntaje).toBeLessThanOrEqual(1000);
    expect(['bajo', 'medio', 'bueno']).toContain(s.franja);
    expect(s.segmento.name).toBeTruthy(); // segmento entrenado con EMICRON (DANE)
    expect(s.componentes.map((c: { name: string }) => c.name).sort()).toEqual(['negocio', 'pagos']);
    expect(s.explicacion.resumen).toContain('Puntaje TendIA');
    expect(s.explicacionFuente).toBe('plantilla');
    // Referencia real de tasas (Superfinanciera) según la franja.
    expect(evaluada.body.mercado.tasaEfectivaAnual).toBeGreaterThan(0);
    expect(evaluada.body.mercado.fuente).toContain('Superintendencia');
    const original = evaluada.body.score.puntaje as number;

    // T8: enero tuvo obras en la calle.
    const hasta = lastClosedMonth();
    let enero = hasta;
    for (let i = 0; i < 12 && !enero.endsWith('-01'); i++) enero = monthAdd(hasta, -i - 1);
    const justificada = await request(http)
      .post(`/solicitudes/${solicitudId}/variaciones`)
      .set(bearer(token))
      .send({ mes: enero, motivo: 'Obras en la calle todo el mes' })
      .expect(200);
    expect(justificada.body.scoreOriginal.puntaje).toBe(original);
    expect(justificada.body.score.conVariaciones).toBe(true);
    expect(justificada.body.score.puntaje).toBeGreaterThanOrEqual(original);

    // T9: enviar al aliado.
    const aliados = await request(http).get('/aliados').set(bearer(token)).expect(200);
    const banco = aliados.body.find((a: { nombre: string }) => a.nombre === 'Banco Demo Popular');
    const enviada = await request(http)
      .post(`/solicitudes/${solicitudId}/enviar`)
      .set(bearer(token))
      .send({ aliadoId: banco.id })
      .expect(200);
    expect(enviada.body.estadoTexto).toBe('Banco Demo Popular está revisando tu solicitud');

    // A1: bandeja del aliado.
    const analista = await loginAliado(app, 'analista@bancodemo.co');
    const bandeja = await request(http)
      .get('/aliado/solicitudes')
      .set(bearer(analista))
      .expect(200);
    expect(bandeja.body.resumen.pendientes).toBe(1);
    expect(bandeja.body.solicitudes[0].conVariaciones).toBe(true);
    expect(['APROBAR', 'PEDIR_GARANTIA', 'RECHAZAR']).toContain(
      bandeja.body.solicitudes[0].recomendacion,
    );

    const detalle = await request(http)
      .get(`/aliado/solicitudes/${solicitudId}`)
      .set(bearer(analista))
      .expect(200);
    expect(detalle.body.variaciones).toHaveLength(1);
    expect(detalle.body.datos.length).toBeGreaterThan(0);

    // A2: pedir garantía FNG.
    await request(http)
      .post(`/aliado/solicitudes/${solicitudId}/decision`)
      .set(bearer(analista))
      .send({ decision: 'PEDIR_GARANTIA', tipoGarantia: 'FNG', nota: 'Monto alto para el puntaje' })
      .expect(200);

    // T10: el tendero responde.
    const conGarantia = await request(http)
      .post(`/solicitudes/${solicitudId}/garantia`)
      .set(bearer(token))
      .send({ respuesta: 'Acepto el respaldo del Fondo Nacional de Garantías' })
      .expect(200);
    expect(conGarantia.body.estado).toBe('GARANTIA_ENVIADA');

    // A3/A4: el aliado acepta y cierra.
    const cerrada = await request(http)
      .post(`/aliado/solicitudes/${solicitudId}/garantia`)
      .set(bearer(analista))
      .send({ aceptar: true, nota: 'Garantía aceptada', plazoAprobado: 8, tasaAprobada: 52.5 })
      .expect(200);
    expect(cerrada.body.estado).toBe('APROBADA');
    // A4: condiciones aprobadas (el monto se mantiene si no se cambia).
    expect(cerrada.body.aprobado).toEqual({
      monto: 3_000_000,
      plazoMeses: 8,
      tasaEfectivaAnual: 52.5,
    });
    expect(cerrada.body.mercado.entidades.length).toBeGreaterThan(0);
    const tenderoVe = await request(http)
      .get(`/solicitudes/${solicitudId}`)
      .set(bearer(token))
      .expect(200);
    expect(tenderoVe.body.aprobado.tasaEfectivaAnual).toBe(52.5);

    // T11-T13 + satisfacción.
    const fin = await request(http)
      .post(`/solicitudes/${solicitudId}/satisfaccion`)
      .set(bearer(token))
      .send({ calificacion: 5 })
      .expect(200);
    expect(fin.body.estadoTexto).toBe('Banco Demo Popular aprobó tu crédito');

    const auditoria = await prisma.auditoria.count({ where: { entidadId: solicitudId } });
    expect(auditoria).toBeGreaterThanOrEqual(4);
  });

  it('pide completar datos cuando el negocio es nuevo (T5) y luego calcula', async () => {
    const { token, solicitudId } = await prepararTendero('3000000004'); // perfil nuevo
    const incompleta = await request(http)
      .post(`/solicitudes/${solicitudId}/evaluar`)
      .set(bearer(token))
      .expect(200);
    expect(incompleta.body.estado).toBe('DATOS_INCOMPLETOS');
    expect(incompleta.body.calidadDatos.issues.length).toBeGreaterThan(0);

    const hasta = lastClosedMonth();
    const meses = Array.from({ length: 12 }, (_, i) => ({
      mes: monthAdd(hasta, -i),
      ventas: 7_000_000 + i * 50_000,
    }));
    await request(http).post('/me/ventas-manuales').set(bearer(token)).send({ meses }).expect(200);
    // Con las ventas del cuaderno ya hay información suficiente para calcular.
    const otra = await request(http)
      .post(`/solicitudes/${solicitudId}/evaluar`)
      .set(bearer(token))
      .expect(200);
    expect(otra.body.estado).toBe('SCORE_LISTO');
    expect(otra.body.score.puntaje).toBeGreaterThan(0);
  });

  it('aísla los datos entre aliados y entre tenderos', async () => {
    const { token, solicitudId } = await prepararTendero('3000000001');
    await request(http).post(`/solicitudes/${solicitudId}/evaluar`).set(bearer(token)).expect(200);
    const aliados = await request(http).get('/aliados').set(bearer(token)).expect(200);
    const banco = aliados.body.find((a: { nombre: string }) => a.nombre === 'Banco Demo Popular');
    await request(http)
      .post(`/solicitudes/${solicitudId}/enviar`)
      .set(bearer(token))
      .send({ aliadoId: banco.id })
      .expect(200);

    const otroAliado = await loginAliado(app, 'admin@microdemo.co');
    await request(http)
      .get(`/aliado/solicitudes/${solicitudId}`)
      .set(bearer(otroAliado))
      .expect(404);
    const bandeja = await request(http)
      .get('/aliado/solicitudes')
      .set(bearer(otroAliado))
      .expect(200);
    expect(bandeja.body.solicitudes.map((s: { id: string }) => s.id)).not.toContain(solicitudId);

    const otroTendero = await loginTendero(app, '3207654321');
    await request(http).get(`/solicitudes/${solicitudId}`).set(bearer(otroTendero)).expect(404);
    // Un tendero no puede usar rutas del aliado.
    await request(http).get('/aliado/solicitudes').set(bearer(otroTendero)).expect(403);
  });

  it('revocar una autorización borra los datos de esa fuente', async () => {
    const token = await loginTendero(app, '3011112233');
    const c = await request(http)
      .post('/consentimientos')
      .set(bearer(token))
      .send({ fuente: 'DATAFONO', proveedor: 'Treinta' })
      .expect(201);
    await request(http)
      .post('/solicitudes')
      .set(bearer(token))
      .send({ monto: 1_000_000, destino: 'Nevera nueva', plazoMeses: 12 })
      .expect(201);
    const lista = await request(http).get('/solicitudes').set(bearer(token)).expect(200);
    await request(http)
      .post(`/solicitudes/${lista.body[0].id}/evaluar`)
      .set(bearer(token))
      .expect(200);
    const antes = await request(http).get('/me/datos').set(bearer(token)).expect(200);
    expect(antes.body.datos.length).toBeGreaterThan(0);

    const revocado = await request(http)
      .delete(`/consentimientos/${c.body.id}`)
      .set(bearer(token))
      .expect(200);
    expect(revocado.body.revocadoEn).toBeTruthy();
    const despues = await request(http).get('/me/datos').set(bearer(token)).expect(200);
    expect(despues.body.datos).toHaveLength(0);
  });

  it('política, llaves de API y consumo de la API pública', async () => {
    const admin = await loginAliado(app, 'admin@bancodemo.co');
    await request(http)
      .put('/aliado/politica')
      .set(bearer(admin))
      .send({ scoreMinAprobar: 40, scoreMinConGarantia: 50, montoMaximo: 5_000_000 })
      .expect(400);
    const p = await request(http)
      .put('/aliado/politica')
      .set(bearer(admin))
      .send({ scoreMinAprobar: 62, scoreMinConGarantia: 48, montoMaximo: 6_000_000 })
      .expect(200);
    expect(p.body.scoreMinAprobar).toBe(62);

    const k = await request(http)
      .post('/aliado/api-keys')
      .set(bearer(admin))
      .send({ nombre: 'Core bancario' })
      .expect(201);
    expect(k.body.llave).toMatch(/^tnd_/);

    await request(http).post('/v1/score').send({}).expect(401);
    const hasta = lastClosedMonth();
    const body = {
      business: { business_age_months: 30 },
      sales: Array.from({ length: 8 }, (_, i) => ({
        month: monthAdd(hasta, -i),
        amount: 8_000_000,
        source: 'datafono',
      })),
      distributor: Array.from({ length: 4 }, (_, i) => ({
        month: monthAdd(hasta, -i),
        purchases: 5_800_000,
        invoices: 5,
        paid_on_time: 5,
        avg_days_late: 0,
      })),
    };
    const score = await request(http)
      .post('/v1/score')
      .set('x-api-key', k.body.llave)
      .send(body)
      .expect(200);
    expect(score.body.score).toBeGreaterThan(0);
    expect(score.body.explanation.resumen).toBeTruthy();
    await request(http)
      .post('/v1/score')
      .set('x-api-key', k.body.llave)
      .send({ business: { business_age_months: 1 }, cedula: '123' })
      .expect(400);

    const consumo = await request(http).get('/aliado/consumo').set(bearer(admin)).expect(200);
    expect(consumo.body.total).toBe(2);
    expect(consumo.body.exitosas).toBe(1);

    await request(http).delete(`/aliado/api-keys/${k.body.id}`).set(bearer(admin)).expect(200);
    await request(http).post('/v1/score').set('x-api-key', k.body.llave).send(body).expect(401);

    // El analista (ya con MFA enrolado) no gestiona llaves.
    const analista = await loginAliado(app, 'analista@bancodemo.co');
    await request(http).get('/aliado/api-keys').set(bearer(analista)).expect(403);
    await request(http).put('/aliado/politica').set(bearer(analista)).send(p.body).expect(403);
    const audit = await request(http).get('/aliado/auditoria').set(bearer(admin)).expect(200);
    expect(audit.body.some((e: { accion: string }) => e.accion === 'crear_api_key')).toBe(true);

    // La política queda versionada: cada cambio sube la versión.
    const v2 = await request(http)
      .put('/aliado/politica')
      .set(bearer(admin))
      .send({ scoreMinAprobar: 60, scoreMinConGarantia: 45, montoMaximo: 6_000_000 })
      .expect(200);
    expect(v2.body.version).toBe(p.body.version + 1);
  });

  it('reiniciar el MFA vuelve a mostrar el QR en el siguiente ingreso', async () => {
    const email = 'analista@bancodemo.co';
    await loginAliado(app, email); // queda enrolado
    const enrolado = await request(http)
      .post('/auth/aliado/login')
      .send({ email, password: 'TendIA-demo-2026!' })
      .expect(200);
    expect(enrolado.body.secreto).toBeUndefined();

    expect(await resetMfa(prisma, email)).toBe(true);
    expect(await resetMfa(prisma, 'no-existe@x.co')).toBe(false);
    const reiniciado = await request(http)
      .post('/auth/aliado/login')
      .send({ email, password: 'TendIA-demo-2026!' })
      .expect(200);
    expect(reiniciado.body.configurarMfa).toBe(true);
    expect(reiniciado.body.otpauthUrl).toMatch(/^otpauth:\/\//);
  });

  it('bloquea la cuenta del analista tras 5 intentos fallidos', async () => {
    const email = 'admin@microdemo.co';
    for (let i = 0; i < 5; i++) {
      await request(http)
        .post('/auth/aliado/login')
        .send({ email, password: 'contraseña-errada' })
        .expect(401);
    }
    // Incluso con la contraseña correcta, la cuenta queda bloqueada temporalmente.
    const bloqueada = await request(http)
      .post('/auth/aliado/login')
      .send({ email, password: 'TendIA-demo-2026!' })
      .expect(429);
    expect(bloqueada.body.message).toMatch(/bloqueada/);
    expect(await prisma.auditoria.count({ where: { accion: 'bloqueo_por_intentos' } })).toBe(1);
  });
});
