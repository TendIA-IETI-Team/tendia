'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { ContribucionesChart, VentasChart } from '@/components/charts';
import { PageTitle } from '@/components/Shell';
import {
  Alerta,
  Badge,
  Button,
  Card,
  EstadoBadge,
  Field,
  inputClass,
  ScoreHero,
  Vacio,
} from '@/components/ui';
import { puntos } from '@/components/charts';
import { api, type DetalleSolicitud, type Mercado, type Segmento } from '@/lib/api';
import { fecha, GARANTIAS, mesCorto, pesos, porcentaje, RECOMENDACIONES } from '@/lib/format';

const PRIORIDAD_VENTAS = ['DATAFONO', 'OPEN_FINANCE', 'MANUAL'];

export default function DetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<DetalleSolicitud | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<DetalleSolicitud>(`/aliado/solicitudes/${id}`)
      .then(setD)
      .catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(cargar, [cargar]);

  const ventas = useMemo(() => {
    if (!d) return [];
    const porMes = new Map<string, { prio: number; ventas: number }>();
    for (const r of d.datos) {
      const prio = PRIORIDAD_VENTAS.indexOf(r.fuente);
      if (prio < 0 || r.ventas === null) continue;
      const actual = porMes.get(r.mes);
      if (!actual || prio < actual.prio) porMes.set(r.mes, { prio, ventas: r.ventas });
    }
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([mes, v]) => ({ mes, ventas: v.ventas }));
  }, [d]);

  const proveedor = useMemo(
    () => (d ? d.datos.filter((r) => r.fuente === 'DISTRIBUIDOR').slice(-12) : []),
    [d],
  );

  if (error) return <Alerta>{error}</Alerta>;
  if (!d) return <Vacio>Cargando…</Vacio>;

  const s = d.score;
  return (
    <>
      <Link
        href="/bandeja"
        className="mb-2 inline-block text-sm font-bold text-brand-500 hover:underline"
      >
        ← Volver a solicitudes
      </Link>
      <PageTitle
        title={d.negocio?.nombre ?? 'Negocio sin nombre'}
        subtitle={`${d.negocio?.tipo ?? 'tienda'} · ${d.negocio?.barrio ?? ''} ${d.negocio?.ciudad ?? ''} · recibida el ${fecha(d.enviadaEn)}`}
        action={<EstadoBadge estado={d.estado} />}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          <Card title="Puntaje TendIA">
            {s ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <ScoreHero puntaje={s.puntaje} />
                  {s.componentes.length > 0 && (
                    <ul className="mt-4 space-y-1 text-sm">
                      {s.componentes.map((c) => (
                        <li key={c.name} className="flex justify-between gap-3">
                          <span>
                            {c.label}
                            <span className="block text-[11px] text-ink-muted">{c.trained_on}</span>
                          </span>
                          <span
                            className={`tabular font-bold ${c.points >= 0 ? 'text-brand-700' : 'text-[#8E3560]'}`}
                          >
                            {puntos(c.points, 0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {d.scoreOriginal && (
                    <p className="mt-4 text-sm text-ink-muted">
                      Puntaje antes de las justificaciones:{' '}
                      <strong className="tabular text-brand-900">{d.scoreOriginal.puntaje}</strong>{' '}
                      ({s.puntaje - d.scoreOriginal.puntaje >= 0 ? '+' : ''}
                      {s.puntaje - d.scoreOriginal.puntaje} puntos)
                    </p>
                  )}
                  <p className="mt-2 text-xs text-ink-muted">
                    Modelo {s.modeloVersion} · probabilidad de incumplimiento a 90 días como base
                    del puntaje
                  </p>
                </div>
                <div className="rounded-lg bg-brand-50 p-4 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-bold text-brand-900">
                    Lo que le explicamos al tendero
                    <Badge tono="neutral">
                      {s.explicacionFuente === 'ia' ? 'IA generativa' : 'Plantilla'}
                    </Badge>
                  </div>
                  <p className="text-ink">{s.explicacion.resumen}</p>
                </div>
              </div>
            ) : (
              <Vacio>Sin puntaje.</Vacio>
            )}
          </Card>

          {s && (
            <Card
              title="Qué pesó en el puntaje"
              action={
                <span className="text-xs text-ink-muted">Puntos frente a un negocio promedio</span>
              }
            >
              <ContribucionesChart contribuciones={s.contribuciones} />
            </Card>
          )}

          {d.variaciones.length > 0 && (
            <Card title="Variaciones justificadas por el tendero">
              <ul className="space-y-2 text-sm">
                {d.variaciones.map((v) => (
                  <li
                    key={v.mes}
                    className="flex gap-3 rounded-lg border border-accent-100 bg-accent-100/40 p-3"
                  >
                    <span className="font-bold text-accent-700">{mesCorto(v.mes)}</span>
                    <span>{v.motivo}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Ventas por mes">
            {ventas.length ? (
              <VentasChart datos={ventas} justificados={d.variaciones} />
            ) : (
              <Vacio>Sin datos de ventas.</Vacio>
            )}
          </Card>

          <Card title="Pagos al proveedor">
            {proveedor.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase text-ink-muted">
                      <th className="py-2">Mes</th>
                      <th className="py-2 text-right">Compras fiadas</th>
                      <th className="py-2 text-right">Pagado</th>
                      <th className="py-2 text-right">Cupo</th>
                      <th className="py-2 text-right">Facturas a tiempo</th>
                      <th className="py-2 text-right">Días de retraso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedor.map((r) => (
                      <tr key={r.mes} className="tabular border-b border-line last:border-0">
                        <td className="py-1.5">{mesCorto(r.mes)}</td>
                        <td className="py-1.5 text-right">{pesos(r.compras ?? 0)}</td>
                        <td className="py-1.5 text-right">{r.pagado ? pesos(r.pagado) : '—'}</td>
                        <td className="py-1.5 text-right">{r.cupo ? pesos(r.cupo) : '—'}</td>
                        <td className="py-1.5 text-right">
                          {r.pagadasATiempo}/{r.facturas}
                        </td>
                        <td className="py-1.5 text-right">{r.diasRetrasoPromedio ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vacio>Sin datos del proveedor.</Vacio>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Solicitud">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Dato label="Monto" valor={pesos(d.monto)} />
              <Dato label="Plazo" valor={`${d.plazoMeses} meses`} />
              <Dato label="Destino" valor={d.destino} ancho />
              <Dato label="Propietario" valor={d.negocio?.propietario ?? '—'} />
              <Dato
                label="Antigüedad"
                valor={d.negocio?.antiguedadMeses ? `${d.negocio.antiguedadMeses} meses` : '—'}
              />
            </dl>
          </Card>
          <Decision d={d} onCambio={setD} />
          {s?.segmento && <SegmentoCard segmento={s.segmento} />}
          {d.mercado && <MercadoCard mercado={d.mercado} franja={s?.franjaNombre ?? ''} />}
          {(d.calidadDatos?.issues?.length ?? 0) > 0 && (
            <Card title="Alertas de datos">
              <ul className="space-y-2 text-sm">
                {d.calidadDatos!.issues.map((i) => (
                  <li key={i.code}>
                    <Alerta tono="warning">{i.message}</Alerta>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/** Segmento del negocio, con lo que muestran los datos reales de EMICRON 2024 (DANE). */
function SegmentoCard({ segmento: g }: { segmento: Segmento }) {
  return (
    <Card title="Tipo de negocio">
      <div className="text-lg font-extrabold text-brand-700">{g.name}</div>
      <p className="mb-3 text-sm text-ink-muted">{g.description}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Dato label="Ventas típicas" valor={pesos(g.median_monthly_sales)} />
        <Dato label="Antigüedad típica" valor={`${Math.round(g.median_age_months / 12)} años`} />
        <Dato label="Pidieron crédito" valor={porcentaje(g.requested_credit)} />
        <Dato label="Acudieron al gota a gota" valor={porcentaje(g.used_loan_sharks)} />
      </dl>
      <p className="mt-3 text-[11px] text-ink-muted">
        Micronegocios de comercio con este perfil en Colombia ({porcentaje(g.share_of_businesses)}{' '}
        del total). Fuente: DANE, EMICRON 2024, {g.n_sample.toLocaleString('es-CO')} encuestados.
      </p>
    </Card>
  );
}

/** Tasas reales cobradas a tiendas de Bogotá (Superfinanciera), como referencia para decidir. */
function MercadoCard({ mercado: m, franja }: { mercado: Mercado; franja: string }) {
  return (
    <Card title="Referencia del mercado">
      <div className="flex items-baseline gap-2">
        <span className="tabular text-3xl font-extrabold text-brand-700">
          {m.tasaEfectivaAnual.toLocaleString('es-CO')} %
        </span>
        <span className="text-sm text-ink-muted">E.A. para franja {franja.toLowerCase()}</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        La mitad de los créditos productivos a tiendas en Bogotá estuvo entre{' '}
        {m.rango.desde.toLocaleString('es-CO')} % y {m.rango.hasta.toLocaleString('es-CO')} % E.A. (
        {m.creditos.toLocaleString('es-CO')} créditos, {fecha(m.periodo.desde)} a{' '}
        {fecha(m.periodo.hasta)}).
      </p>
      {m.entidades && m.entidades.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left uppercase text-ink-muted">
              <th className="py-1">Entidad</th>
              <th className="py-1 text-right">Créditos</th>
              <th className="py-1 text-right">Tasa E.A.</th>
            </tr>
          </thead>
          <tbody>
            {m.entidades.slice(0, 6).map((e) => (
              <tr key={e.entidad} className="tabular border-t border-line">
                <td className="py-1">{e.entidad}</td>
                <td className="py-1 text-right">{e.creditos.toLocaleString('es-CO')}</td>
                <td className="py-1 text-right">{e.tasa_promedio_ponderada} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-[11px] text-ink-muted">Fuente: {m.fuente}.</p>
    </Card>
  );
}

function Dato({ label, valor, ancho = false }: { label: string; valor: string; ancho?: boolean }) {
  return (
    <div className={ancho ? 'col-span-2' : ''}>
      <dt className="text-xs font-bold uppercase text-ink-muted">{label}</dt>
      <dd className="tabular font-semibold text-brand-900">{valor}</dd>
    </div>
  );
}

/** A2 (decidir) y A3/A4 (evaluar garantía y cerrar). */
function Decision({
  d,
  onCambio,
}: {
  d: DetalleSolicitud;
  onCambio: (d: DetalleSolicitud) => void;
}) {
  const [nota, setNota] = useState('');
  const [tipo, setTipo] = useState('FNG');
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // A4: condiciones de aprobación. La tasa arranca en la referencia real del mercado.
  const [monto, setMonto] = useState(String(d.monto));
  const [plazo, setPlazo] = useState(String(d.plazoMeses));
  const [tasa, setTasa] = useState(d.mercado ? String(d.mercado.tasaEfectivaAnual) : '');
  const condiciones = {
    montoAprobado: Number(monto) || undefined,
    plazoAprobado: Number(plazo) || undefined,
    tasaAprobada: tasa ? Number(tasa) : undefined,
  };

  const condicionesInput = (
    <fieldset className="grid grid-cols-3 gap-2">
      <legend className="mb-1 text-sm font-bold text-brand-900">Condiciones si se aprueba</legend>
      <Field label="Monto">
        <input
          className={inputClass}
          type="number"
          min={100000}
          step={50000}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
      </Field>
      <Field label="Plazo (meses)">
        <input
          className={inputClass}
          type="number"
          min={1}
          max={60}
          value={plazo}
          onChange={(e) => setPlazo(e.target.value)}
        />
      </Field>
      <Field label="Tasa E.A. %">
        <input
          className={inputClass}
          type="number"
          min={0}
          max={150}
          step={0.1}
          value={tasa}
          onChange={(e) => setTasa(e.target.value)}
        />
      </Field>
    </fieldset>
  );

  async function enviar(path: string, body: object) {
    setEnviando(true);
    setError(null);
    try {
      onCambio(
        await api<DetalleSolicitud>(`/aliado/solicitudes/${d.id}/${path}`, {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
      setNota('');
      setPidiendo(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const sugerencia = d.recomendacion && (
    <div className="mb-4 rounded-lg bg-brand-50 p-3 text-sm">
      <div className="text-xs font-bold uppercase text-ink-muted">Sugerencia según su política</div>
      <div className="font-bold text-brand-900">{RECOMENDACIONES[d.recomendacion]}</div>
      <div className="text-xs text-ink-muted">{d.motivo}</div>
    </div>
  );

  const notaInput = (
    <Field label="Nota (opcional)">
      <textarea
        className={inputClass}
        rows={2}
        maxLength={500}
        value={nota}
        onChange={(e) => setNota(e.target.value)}
      />
    </Field>
  );

  if (d.estado === 'ENVIADA') {
    return (
      <Card title="Decisión">
        {sugerencia}
        <div className="space-y-3">
          {notaInput}
          {pidiendo ? (
            <>
              <Field label="Tipo de garantía">
                <select
                  className={inputClass}
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  {Object.entries(GARANTIAS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-2">
                <Button
                  variant="accent"
                  disabled={enviando}
                  onClick={() =>
                    enviar('decision', {
                      decision: 'PEDIR_GARANTIA',
                      tipoGarantia: tipo,
                      nota: nota || undefined,
                    })
                  }
                >
                  Enviar solicitud de garantía
                </Button>
                <Button variant="secondary" onClick={() => setPidiendo(false)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              {condicionesInput}
              <Button
                disabled={enviando}
                onClick={() =>
                  enviar('decision', {
                    decision: 'APROBAR',
                    nota: nota || undefined,
                    ...condiciones,
                  })
                }
              >
                Aprobar crédito
              </Button>
              <Button variant="secondary" disabled={enviando} onClick={() => setPidiendo(true)}>
                Pedir garantía
              </Button>
              <Button
                variant="danger"
                disabled={enviando}
                onClick={() =>
                  enviar('decision', { decision: 'RECHAZAR', nota: nota || undefined })
                }
              >
                Rechazar
              </Button>
            </div>
          )}
          {error && <Alerta>{error}</Alerta>}
        </div>
      </Card>
    );
  }

  if (d.estado === 'GARANTIA_ENVIADA' && d.garantia) {
    return (
      <Card title="Evaluar garantía">
        <div className="mb-4 space-y-2 text-sm">
          <div>
            <span className="text-xs font-bold uppercase text-ink-muted">Pedida</span>
            <div className="font-semibold">{GARANTIAS[d.garantia.tipo]}</div>
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-ink-muted">
              Respuesta del tendero
            </span>
            <p className="rounded-lg bg-brand-50 p-3">{d.garantia.respuesta}</p>
          </div>
        </div>
        <div className="space-y-3">
          {notaInput}
          <div className="grid gap-2">
            {condicionesInput}
            <Button
              disabled={enviando}
              onClick={() =>
                enviar('garantia', { aceptar: true, nota: nota || undefined, ...condiciones })
              }
            >
              Aceptar garantía y aprobar
            </Button>
            <Button
              variant="danger"
              disabled={enviando}
              onClick={() => enviar('garantia', { aceptar: false, nota: nota || undefined })}
            >
              Rechazar garantía
            </Button>
          </div>
          {error && <Alerta>{error}</Alerta>}
        </div>
      </Card>
    );
  }

  return (
    <Card title="Decisión">
      {sugerencia}
      {d.estado === 'GARANTIA_SOLICITADA' && (
        <Alerta tono="info">Esperando que el tendero responda la solicitud de garantía.</Alerta>
      )}
      {d.estado === 'APROBADA' && (
        <Alerta tono="success">
          <span className="block font-bold">Crédito aprobado.</span>
          {d.aprobado && (
            <span className="tabular block">
              {pesos(d.aprobado.monto)} a {d.aprobado.plazoMeses} meses
              {d.aprobado.tasaEfectivaAnual !== null &&
                `, ${d.aprobado.tasaEfectivaAnual.toLocaleString('es-CO')} % E.A.`}
            </span>
          )}
          {d.notaDecision}
        </Alerta>
      )}
      {d.estado === 'RECHAZADA' && (
        <Alerta tono="warning">
          Solicitud rechazada. El tendero recibió consejos para mejorar. {d.notaDecision}
        </Alerta>
      )}
    </Card>
  );
}
