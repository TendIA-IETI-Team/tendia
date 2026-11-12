'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/Shell';
import { Alerta, Button, Card, Field, inputClass } from '@/components/ui';
import { api, session, type Politica } from '@/lib/api';
import { pesos } from '@/lib/format';

/** Configurar la política de riesgo (TND-061). Solo el administrador del aliado la cambia. */
export default function PoliticaPage() {
  const [p, setP] = useState<Politica | null>(null);
  // Última política válida: mientras el formulario tiene un valor imposible, el resumen la muestra.
  const [guardada, setGuardada] = useState<Politica | null>(null);
  const [msg, setMsg] = useState<{ tono: 'success' | 'danger'; texto: string } | null>(null);
  const admin = session.usuario?.rol === 'ADMIN_ALIADO';

  useEffect(() => {
    api<Politica>('/aliado/politica')
      .then((r) => {
        setP(r);
        setGuardada(r);
      })
      .catch((e: Error) => setMsg({ tono: 'danger', texto: e.message }));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    setMsg(null);
    try {
      const r = await api<Politica>('/aliado/politica', {
        method: 'PUT',
        body: JSON.stringify({
          scoreMinAprobar: p.scoreMinAprobar,
          scoreMinConGarantia: p.scoreMinConGarantia,
          montoMaximo: p.montoMaximo,
        }),
      });
      setP(r);
      setGuardada(r);
      setMsg({
        tono: 'success',
        texto: 'Política guardada. Las sugerencias de la bandeja ya la usan.',
      });
    } catch (err) {
      setMsg({ tono: 'danger', texto: (err as Error).message });
    }
  }

  const valida = p !== null && p.scoreMinConGarantia <= p.scoreMinAprobar;
  const vista = valida ? p : guardada;

  const num = (k: keyof Politica) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setP((prev) => prev && { ...prev, [k]: Number(e.target.value) });

  return (
    <>
      <PageTitle
        title="Política de riesgo"
        subtitle="Define cuándo sugerimos aprobar, pedir garantía o rechazar. La decisión final siempre es del analista."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          {p && (
            <form onSubmit={guardar} className="space-y-5">
              <fieldset disabled={!admin} className="grid gap-4 sm:grid-cols-3">
                <Field label="Puntaje mínimo para aprobar" hint="Escala 0-1000 (bueno ≥ 650)">
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={1000}
                    required
                    value={p.scoreMinAprobar}
                    onChange={num('scoreMinAprobar')}
                  />
                </Field>
                <Field
                  label="Puntaje mínimo con garantía"
                  hint="Debe ser menor o igual al anterior"
                >
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={1000}
                    required
                    value={p.scoreMinConGarantia}
                    onChange={num('scoreMinConGarantia')}
                  />
                </Field>
                <Field label="Monto máximo (pesos)" hint={pesos(p.montoMaximo)}>
                  <input
                    className={inputClass}
                    type="number"
                    min={100000}
                    step={100000}
                    required
                    value={p.montoMaximo}
                    onChange={num('montoMaximo')}
                  />
                </Field>
              </fieldset>
              {msg && <Alerta tono={msg.tono}>{msg.texto}</Alerta>}
              {admin ? (
                <Button type="submit">Guardar política</Button>
              ) : (
                <Alerta tono="info">Solo el administrador puede cambiar la política.</Alerta>
              )}
            </form>
          )}
        </Card>
        {vista && (
          <Card title="Cómo se aplica">
            <ol className="space-y-3 text-sm">
              <li>
                <strong className="text-brand-900">Aprobar:</strong> puntaje ≥{' '}
                {vista.scoreMinAprobar} y monto ≤ {pesos(vista.montoMaximo)}.
              </li>
              <li>
                <strong className="text-brand-900">Pedir garantía:</strong>{' '}
                {vista.scoreMinConGarantia < vista.scoreMinAprobar
                  ? `puntaje entre ${vista.scoreMinConGarantia} y ${vista.scoreMinAprobar - 1}, o monto mayor al máximo con buen puntaje.`
                  : 'solo cuando el monto pasa del máximo con buen puntaje.'}
              </li>
              <li>
                <strong className="text-brand-900">Rechazar:</strong> puntaje menor a{' '}
                {vista.scoreMinConGarantia}. El tendero recibe consejos para mejorar.
              </li>
            </ol>
            {!valida && (
              <p className="mt-3 text-xs text-ink-muted">
                Muestra la política guardada hasta que corrijas los valores.
              </p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
