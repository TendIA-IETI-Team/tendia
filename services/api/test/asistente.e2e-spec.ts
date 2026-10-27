import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { hoyBogota, sumarDias } from '../src/registros/montos';
import { bearer, createApp, loginTendero } from './helpers';

describe('Cuaderno digital, asistente y WhatsApp (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token: string;
  const celular = '3155550101';

  beforeAll(async () => {
    ({ app, prisma } = await createApp());
    http = app.getHttpServer();
    token = await loginTendero(app, celular);
    await request(http)
      .put('/me/negocio')
      .set(bearer(token))
      .send({ nombre: 'Tienda Rosa', antiguedadMeses: 60 })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('registra ventas del día y fiados, y los resume', async () => {
    await request(http)
      .post('/me/ventas-diarias')
      .set(bearer(token))
      .send({ monto: 300000 })
      .expect(200);
    // Registrar el mismo día corrige el valor.
    await request(http)
      .post('/me/ventas-diarias')
      .set(bearer(token))
      .send({ monto: 320000 })
      .expect(200);
    await request(http)
      .post('/me/ventas-diarias')
      .set(bearer(token))
      .send({ monto: 1000, fecha: sumarDias(hoyBogota(), 3) })
      .expect(400);
    const f = await request(http)
      .post('/me/fiados')
      .set(bearer(token))
      .send({ cliente: 'Don Pedro', monto: 20000 })
      .expect(201);
    const r = await request(http).get('/me/registros').set(bearer(token)).expect(200);
    expect(r.body.ventaHoy).toBe(320000);
    expect(r.body.totalFiado).toBe(20000);
    await request(http).post(`/me/fiados/${f.body.id}/pago`).set(bearer(token)).expect(200);
    const r2 = await request(http).get('/me/registros').set(bearer(token)).expect(200);
    expect(r2.body.totalFiado).toBe(0);
  });

  it('estima las ventas del mes con un día normal y uno flojo (T5)', async () => {
    const r = await request(http)
      .post('/me/estimacion-ventas')
      .set(bearer(token))
      .send({ diaNormal: 150000, diaFlojo: 60000, diasFlojosPorSemana: 2 })
      .expect(200);
    expect(r.body).toEqual({ semana: 870000, mes: 3770000 });
    const me = await request(http).get('/me').set(bearer(token)).expect(200);
    expect(me.body.negocio.ventasMensualesDeclaradas).toBe(3770000);
  });

  it('el asistente anota ventas y fiados en lenguaje natural (sin IA: intérprete)', async () => {
    const venta = await request(http)
      .post('/asistente/mensajes')
      .set(bearer(token))
      .send({ mensaje: 'Ayer vendí 410 mil' })
      .expect(200);
    expect(venta.body.acciones[0].tipo).toBe('venta');
    expect(venta.body.respuesta).toContain('$410.000');

    const fiado = await request(http)
      .post('/asistente/mensajes')
      .set(bearer(token))
      .send({ mensaje: 'Le fié 15 mil a doña Marta' })
      .expect(200);
    expect(fiado.body.respuesta).toContain('Doña Marta');

    const resumen = await request(http)
      .post('/asistente/mensajes')
      .set(bearer(token))
      .send({ mensaje: '¿cómo voy?' })
      .expect(200);
    expect(resumen.body.respuesta).toContain('Te deben $15.000');

    const historial = await request(http).get('/asistente/mensajes').set(bearer(token)).expect(200);
    expect(historial.body).toHaveLength(6);
    expect(historial.body[0].rol).toBe('user');
  });

  it('la lectura de fotos del cuaderno avisa cuando la IA no está configurada', async () => {
    const d = await request(http).get('/me/cuaderno/disponible').set(bearer(token)).expect(200);
    expect(d.body.disponible).toBe(false);
    await request(http)
      .post('/me/cuaderno')
      .set(bearer(token))
      .send({ imagenBase64: 'aGVsbG8=', tipo: 'image/jpeg' })
      .expect(503);
  });

  it('guardar dos veces la misma hoja del cuaderno no repite los fiados', async () => {
    const tendero = await prisma.tendero.findFirstOrThrow({ include: { negocio: true } });
    const hoja = {
      registros: [
        { fecha: '2026-10-21', ventas: 310000, fiados: [{ cliente: 'doña Rosa', monto: 15000 }] },
      ],
    };
    for (let vez = 1; vez <= 2; vez++) {
      const e = await prisma.extraccionCuaderno.create({
        data: { tenderoId: tendero.id, datos: hoja, canal: 'app' },
      });
      const r = await request(http)
        .post(`/me/cuaderno/${e.id}/confirmar`)
        .set(bearer(token))
        .send({})
        .expect(200);
      expect(r.body).toEqual({ ventasGuardadas: 1, fiadosGuardados: vez === 1 ? 1 : 0 });
    }
    const fiados = await prisma.fiado.count({
      where: { negocioId: tendero.negocio!.id, canal: 'cuaderno', fecha: '2026-10-21' },
    });
    expect(fiados).toBe(1);
  });

  it('WhatsApp: el tendero registrado anota ventas desde su número', async () => {
    const r = await request(http)
      .post('/whatsapp/webhook')
      .type('form')
      .send({ From: `whatsapp:+57${celular}`, Body: 'hoy vendí 280 mil', NumMedia: '0' })
      .expect(200);
    expect(r.headers['content-type']).toContain('text/xml');
    expect(r.text).toContain('$280.000');
    const venta = await prisma.ventaDiaria.findFirst({ where: { canal: 'whatsapp' } });
    expect(venta?.monto).toBe(280000);
  });

  it('WhatsApp: un número no registrado recibe instrucciones', async () => {
    const r = await request(http)
      .post('/whatsapp/webhook')
      .type('form')
      .send({ From: 'whatsapp:+573009990000', Body: 'hola' })
      .expect(200);
    expect(r.text).toContain('regístrate en la app');
  });

  it('las ventas diarias alimentan el puntaje como datos declarados', async () => {
    // Un negocio sin datáfono: 10 días anotados en cada uno de 6 meses + proveedor simulado.
    const t = await loginTendero(app, '3155550202');
    await request(http).put('/me/negocio').set(bearer(t)).send({ antiguedadMeses: 30 }).expect(200);
    await request(http)
      .post('/consentimientos')
      .set(bearer(t))
      .send({ fuente: 'DISTRIBUIDOR', proveedor: 'Distribuidor mayorista (simulado)' })
      .expect(201);
    const hoy = hoyBogota();
    for (let m = 1; m <= 6; m++) {
      const mes = sumarDias(`${hoy.slice(0, 7)}-15`, -30 * m).slice(0, 7);
      for (let d = 1; d <= 10; d++) {
        await request(http)
          .post('/me/ventas-diarias')
          .set(bearer(t))
          .send({ monto: 120000 + d * 1000, fecha: `${mes}-${String(d).padStart(2, '0')}` })
          .expect(200);
      }
    }
    const sol = await request(http)
      .post('/solicitudes')
      .set(bearer(t))
      .send({ monto: 1_000_000, destino: 'Surtir la tienda', plazoMeses: 6 })
      .expect(201);
    const ev = await request(http)
      .post(`/solicitudes/${sol.body.id}/evaluar`)
      .set(bearer(t))
      .expect(200);
    expect(ev.body.estado).toBe('SCORE_LISTO');
    expect(ev.body.score.puntaje).toBeGreaterThan(0);
  });

  it('las referencias de mercado son datos reales', async () => {
    const r = await request(http).get('/referencias').set(bearer(token)).expect(200);
    expect(r.body.tasas.filtro).toContain('CIIU 4711');
    expect(r.body.emicron.fuente).toContain('EMICRON');
  });
});
