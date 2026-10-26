'use client';

import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/Shell';
import { type Satisfaccion, TableroSatisfaccion } from '@/components/Satisfaccion';
import { Alerta, Badge, Button, Card, Field, inputClass, Vacio } from '@/components/ui';
import { api } from '@/lib/api';
import { fecha } from '@/lib/format';

interface Evento {
  id: string;
  creadoEn: string;
  actorTipo: string;
  actorId: string;
  aliado: string | null;
  accion: string;
  entidad: string;
  finalidad: string | null;
}
interface Bitacora {
  tenderoId: string;
  registradoEn: string;
  eventos: Evento[];
}

const ACTORES: Record<string, string> = {
  USUARIO: 'Analista o administrador',
  TENDERO: 'El tendero',
  API_KEY: 'Integración (llave de API)',
  SISTEMA: 'Sistema',
};

const FINALIDADES: Record<string, string> = {
  evaluar_credito: 'Evaluar el crédito',
  decidir_credito: 'Decidir el crédito',
  revisar_documento: 'Revisar un documento',
  consulta_api: 'Consulta por API',
  administrar_cuenta: 'Administrar la cuenta',
  atender_titular: 'Atender al titular',
};

/**
 * Equipo de TendIA (ADMIN_TENDIA): bitácora de un tendero para responder a un reclamo o a la SIC
 * (TND-022) y satisfacción de todos los aliados (TND-081).
 */
export default function AdminPage() {
  const [celular, setCelular] = useState('');
  const [bitacora, setBitacora] = useState<Bitacora | null>(null);
  const [satisfaccion, setSatisfaccion] = useState<Satisfaccion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    api<Satisfaccion>('/admin/satisfaccion')
      .then(setSatisfaccion)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBitacora(null);
    setBuscando(true);
    try {
      setBitacora(
        await api<Bitacora>(`/admin/bitacora?celular=${encodeURIComponent(celular.trim())}`),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Bitácora por tendero"
        subtitle="Quién consultó o cambió los datos de un tendero, cuándo y para qué. La bitácora no se puede editar ni borrar, y esta consulta también queda registrada."
      />
      <Card className="mb-5">
        <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="Celular del tendero">
              <input
                className={inputClass}
                inputMode="tel"
                placeholder="300 000 0001"
                required
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" disabled={buscando}>
            {buscando ? 'Buscando…' : 'Ver bitácora'}
          </Button>
        </form>
      </Card>
      {error && (
        <div className="mb-5">
          <Alerta>{error}</Alerta>
        </div>
      )}
      {bitacora && (
        <Card
          className="mb-8"
          title={`${bitacora.eventos.length} eventos`}
          action={
            <span className="text-xs text-ink-muted">
              Registrado el {fecha(bitacora.registradoEn)}
            </span>
          }
        >
          {bitacora.eventos.length === 0 ? (
            <Vacio>Sin eventos.</Vacio>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase text-ink-muted">
                    <th className="py-2 pr-4">Fecha y hora</th>
                    <th className="py-2 pr-4">Quién</th>
                    <th className="py-2 pr-4">Entidad</th>
                    <th className="py-2 pr-4">Acción</th>
                    <th className="py-2">Finalidad</th>
                  </tr>
                </thead>
                <tbody>
                  {bitacora.eventos.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="tabular py-2 pr-4 text-ink-muted">
                        {new Date(e.creadoEn).toLocaleString('es-CO')}
                      </td>
                      <td className="py-2 pr-4">{ACTORES[e.actorTipo] ?? e.actorTipo}</td>
                      <td className="py-2 pr-4">{e.aliado ?? '—'}</td>
                      <td className="py-2 pr-4 font-semibold">{e.accion.replaceAll('_', ' ')}</td>
                      <td className="py-2">
                        {e.finalidad ? (
                          <Badge tono="info">{FINALIDADES[e.finalidad] ?? e.finalidad}</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <h2 className="mb-3 text-lg font-extrabold text-brand-900">
        Satisfacción en todos los aliados
      </h2>
      {satisfaccion && <TableroSatisfaccion datos={satisfaccion} conAliado />}
    </>
  );
}
