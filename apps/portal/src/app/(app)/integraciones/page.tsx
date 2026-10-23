'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConsumoChart } from '@/components/charts';
import { PageTitle } from '@/components/Shell';
import { Alerta, Badge, Button, Card, Field, inputClass, Vacio } from '@/components/ui';
import { api, API_URL, session } from '@/lib/api';
import { fecha } from '@/lib/format';

interface Llave {
  id: string;
  nombre: string;
  prefijo: string;
  creadaEn: string;
  revocadaEn: string | null;
  ultimoUso: string | null;
}
interface Consumo {
  dias: number;
  total: number;
  exitosas: number;
  porDia: { dia: string; consultas: number; exitosas: number }[];
}

/** Credenciales de API (TND-013), documentación (TND-064) y consumo (TND-065). */
export default function IntegracionesPage() {
  const admin = session.usuario?.rol === 'ADMIN_ALIADO';
  const [llaves, setLlaves] = useState<Llave[]>([]);
  const [consumo, setConsumo] = useState<Consumo | null>(null);
  const [nombre, setNombre] = useState('');
  const [nueva, setNueva] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<Consumo>('/aliado/consumo')
      .then(setConsumo)
      .catch((e: Error) => setError(e.message));
    if (admin)
      api<Llave[]>('/aliado/api-keys')
        .then(setLlaves)
        .catch((e: Error) => setError(e.message));
  }, [admin]);
  useEffect(cargar, [cargar]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api<{ llave: string }>('/aliado/api-keys', {
        method: 'POST',
        body: JSON.stringify({ nombre }),
      });
      setNueva(r.llave);
      setNombre('');
      cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revocar(id: string) {
    await api(`/aliado/api-keys/${id}`, { method: 'DELETE' }).catch((e: Error) =>
      setError(e.message),
    );
    cargar();
  }

  return (
    <>
      <PageTitle
        title="API y consumo"
        subtitle="Consulten el Puntaje TendIA desde su core con una llave de API. Se factura por consulta."
        action={
          <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
            <Button variant="secondary">Ver documentación</Button>
          </a>
        }
      />
      {error && (
        <div className="mb-4">
          <Alerta>{error}</Alerta>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Consultas de los últimos 30 días">
          {consumo && (
            <>
              <div className="mb-4 flex gap-8">
                <div>
                  <div className="tabular text-3xl font-extrabold text-brand-700">
                    {consumo.total}
                  </div>
                  <div className="text-xs font-bold uppercase text-ink-muted">Consultas</div>
                </div>
                <div>
                  <div className="tabular text-3xl font-extrabold text-brand-700">
                    {consumo.exitosas}
                  </div>
                  <div className="text-xs font-bold uppercase text-ink-muted">Exitosas</div>
                </div>
              </div>
              {consumo.porDia.length ? (
                <ConsumoChart porDia={consumo.porDia} />
              ) : (
                <Vacio>Todavía no hay consultas.</Vacio>
              )}
            </>
          )}
        </Card>
        <Card title="Llaves de API">
          {!admin ? (
            <Alerta tono="info">Solo el administrador gestiona las llaves.</Alerta>
          ) : (
            <div className="space-y-4">
              <form onSubmit={crear} className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <Field label="Nombre de la integración">
                    <input
                      className={inputClass}
                      required
                      minLength={3}
                      maxLength={60}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </Field>
                </div>
                <Button type="submit">Crear llave</Button>
              </form>
              {nueva && (
                <Alerta tono="success">
                  Copia esta llave ahora; no la volveremos a mostrar:
                  <code className="mt-2 block break-all rounded bg-white p-2 text-brand-900">
                    {nueva}
                  </code>
                </Alerta>
              )}
              {llaves.length === 0 ? (
                <Vacio>No hay llaves.</Vacio>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {llaves.map((k) => (
                    <li key={k.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <div className="font-bold text-brand-900">{k.nombre}</div>
                        <div className="text-xs text-ink-muted">
                          tnd_{k.prefijo}_… · creada {fecha(k.creadaEn)} · último uso{' '}
                          {fecha(k.ultimoUso)}
                        </div>
                      </div>
                      {k.revocadaEn ? (
                        <Badge>Revocada</Badge>
                      ) : (
                        <Button variant="danger" onClick={() => revocar(k.id)}>
                          Revocar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
