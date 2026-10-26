'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/Shell';
import { Alerta, Card, Vacio } from '@/components/ui';
import { api } from '@/lib/api';

interface Evento {
  id: string;
  actorTipo: string;
  actorId: string;
  accion: string;
  entidad: string;
  entidadId: string | null;
  finalidad: string | null;
  creadoEn: string;
}

const ACTORES: Record<string, string> = {
  USUARIO: 'Usuario',
  TENDERO: 'Tendero',
  API_KEY: 'Llave de API',
  SISTEMA: 'Sistema',
};

/** Bitácora de auditoría de accesos (TND-022). */
export default function AuditoriaPage() {
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Evento[]>('/aliado/auditoria')
      .then(setEventos)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <PageTitle
        title="Auditoría"
        subtitle="Quién consultó o cambió qué, cuándo y para qué. Últimos 200 eventos; la bitácora no se puede editar ni borrar."
      />
      {error && <Alerta>{error}</Alerta>}
      <Card>
        {!eventos ? (
          <Vacio>Cargando…</Vacio>
        ) : eventos.length === 0 ? (
          <Vacio>Sin eventos.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase text-ink-muted">
                  <th className="py-2 pr-4">Fecha y hora</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Acción</th>
                  <th className="py-2 pr-4">Sobre</th>
                  <th className="py-2">Finalidad</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0">
                    <td className="tabular py-2 pr-4 text-ink-muted">
                      {new Date(e.creadoEn).toLocaleString('es-CO')}
                    </td>
                    <td className="py-2 pr-4">
                      {ACTORES[e.actorTipo] ?? e.actorTipo}{' '}
                      <span className="text-xs text-ink-muted">{e.actorId.slice(0, 8)}</span>
                    </td>
                    <td className="py-2 pr-4 font-semibold">{e.accion.replaceAll('_', ' ')}</td>
                    <td className="py-2 pr-4">
                      {e.entidad}{' '}
                      <span className="text-xs text-ink-muted">{e.entidadId?.slice(0, 8)}</span>
                    </td>
                    <td className="py-2 text-ink-muted">
                      {e.finalidad?.replaceAll('_', ' ') ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
