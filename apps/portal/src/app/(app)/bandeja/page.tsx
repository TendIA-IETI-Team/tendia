'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { puntos } from '@/components/charts';
import { PageTitle } from '@/components/Shell';
import { Alerta, Badge, Card, EstadoBadge, Vacio } from '@/components/ui';
import { api, type Bandeja } from '@/lib/api';
import { ESTADOS, fecha, pesos, RECOMENDACIONES } from '@/lib/format';

const FILTROS = [
  { valor: '', texto: 'Todas' },
  { valor: 'ENVIADA', texto: ESTADOS.ENVIADA.texto },
  { valor: 'GARANTIA_ENVIADA', texto: ESTADOS.GARANTIA_ENVIADA.texto },
  { valor: 'GARANTIA_SOLICITADA', texto: ESTADOS.GARANTIA_SOLICITADA.texto },
  { valor: 'APROBADA', texto: ESTADOS.APROBADA.texto },
  { valor: 'RECHAZADA', texto: ESTADOS.RECHAZADA.texto },
];

/** A1: bandeja de solicitudes con score explicado (TND-060). */
export default function BandejaPage() {
  const [filtro, setFiltro] = useState('');
  const [data, setData] = useState<Bandeja | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api<Bandeja>(`/aliado/solicitudes${filtro ? `?estado=${filtro}` : ''}`)
      .then((d) => vivo && setData(d))
      .catch((e: Error) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [filtro]);

  return (
    <>
      <PageTitle
        title="Solicitudes"
        subtitle="Tenderos que eligieron compartir su Puntaje TendIA con ustedes."
      />
      {error && <Alerta>{error}</Alerta>}
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Por revisar" valor={data.resumen.pendientes} destacado />
          <Stat label="Total" valor={data.resumen.total} />
          <Stat label="Aprobadas" valor={data.resumen.aprobadas} />
          <Stat label="Rechazadas" valor={data.resumen.rechazadas} />
        </div>
      )}
      <Card>
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              role="tab"
              aria-selected={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                filtro === f.valor
                  ? 'bg-brand-700 text-white'
                  : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>
        {!data ? (
          <Vacio>Cargando…</Vacio>
        ) : data.solicitudes.length === 0 ? (
          <Vacio>No hay solicitudes en este estado.</Vacio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-4 font-bold">Negocio</th>
                  <th className="py-2 pr-4 font-bold">Monto</th>
                  <th className="py-2 pr-4 font-bold">Puntaje</th>
                  <th className="py-2 pr-4 font-bold">Factores principales</th>
                  <th className="py-2 pr-4 font-bold">Sugerencia por política</th>
                  <th className="py-2 pr-4 font-bold">Estado</th>
                  <th className="py-2 font-bold">Recibida</th>
                </tr>
              </thead>
              <tbody>
                {data.solicitudes.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-brand-50">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/solicitudes/${s.id}`}
                        className="font-bold text-brand-700 hover:underline"
                      >
                        {s.negocio}
                      </Link>
                      <div className="text-xs text-ink-muted">{s.barrio ?? 'Bogotá'}</div>
                    </td>
                    <td className="tabular py-3 pr-4">
                      {pesos(s.monto)}
                      <div className="text-xs text-ink-muted">{s.plazoMeses} meses</div>
                    </td>
                    <td className="py-3 pr-4">
                      {s.puntaje !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="tabular text-lg font-extrabold text-brand-700">
                            {s.puntaje}
                          </span>
                          <span className="text-xs text-ink-muted">{s.nivel}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                      {s.conVariaciones && <Badge tono="neutral">Con variación justificada</Badge>}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {s.principalesFactores.map((f) => (
                        <div key={f.label} className="flex gap-1">
                          <span
                            className={`tabular font-bold ${f.points >= 0 ? 'text-brand-700' : 'text-[#8E3560]'}`}
                          >
                            {puntos(f.points, 0)}
                          </span>
                          <span className="text-ink-muted">{f.label}</span>
                        </div>
                      ))}
                    </td>
                    <td className="py-3 pr-4">
                      {s.recomendacion && (
                        <span className="font-semibold">{RECOMENDACIONES[s.recomendacion]}</span>
                      )}
                      {s.motivo && <div className="text-xs text-ink-muted">{s.motivo}</div>}
                    </td>
                    <td className="py-3 pr-4">
                      <EstadoBadge estado={s.estado} />
                    </td>
                    <td className="py-3 text-xs text-ink-muted">{fecha(s.enviadaEn)}</td>
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

function Stat({
  label,
  valor,
  destacado = false,
}: {
  label: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-card border p-4 ${destacado ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white'}`}
    >
      <div
        className={`text-xs font-bold uppercase tracking-wide ${destacado ? 'text-brand-100' : 'text-ink-muted'}`}
      >
        {label}
      </div>
      <div className="tabular mt-1 text-3xl font-extrabold">{valor}</div>
    </div>
  );
}
