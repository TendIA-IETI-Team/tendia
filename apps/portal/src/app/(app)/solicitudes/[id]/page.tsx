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
import { api, type DetalleSolicitud } from '@/lib/api';
import { fecha, GARANTIAS, mesCorto, pesos, RECOMENDACIONES } from '@/lib/format';

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
                  <ScoreHero puntaje={s.puntaje} nivel={s.nivel} />
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
                      <th className="py-2 text-right">Compras</th>
                      <th className="py-2 text-right">Facturas a tiempo</th>
                      <th className="py-2 text-right">Días de retraso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proveedor.map((r) => (
                      <tr key={r.mes} className="tabular border-b border-line last:border-0">
                        <td className="py-1.5">{mesCorto(r.mes)}</td>
                        <td className="py-1.5 text-right">{pesos(r.compras ?? 0)}</td>
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
              <Button
                disabled={enviando}
                onClick={() => enviar('decision', { decision: 'APROBAR', nota: nota || undefined })}
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
            <Button
              disabled={enviando}
              onClick={() => enviar('garantia', { aceptar: true, nota: nota || undefined })}
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
        <Alerta tono="success">Crédito aprobado. {d.notaDecision}</Alerta>
      )}
      {d.estado === 'RECHAZADA' && (
        <Alerta tono="warning">
          Solicitud rechazada. El tendero recibió consejos para mejorar. {d.notaDecision}
        </Alerta>
      )}
    </Card>
  );
}
