'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Shell';
import { Alerta, Badge, Button, Card, Field, inputClass, Vacio } from '@/components/ui';
import { api } from '@/lib/api';
import { fecha } from '@/lib/format';

type Tipo = 'BANCO' | 'FINTECH' | 'MICROFINANCIERA' | 'DISTRIBUIDOR';

interface Aliado {
  id: string;
  nombre: string;
  tipo: Tipo;
  administradores: number;
  usuarios: number;
  conMfa: number;
  invitacionesPendientes: { email: string; expiraEn: string }[];
  solicitudes: number;
}
interface Invitacion {
  email: string;
  enlace: string;
  mailto: string;
  expiraEn: string;
}

const TIPOS: Record<Tipo, string> = {
  BANCO: 'Banco',
  FINTECH: 'Fintech',
  MICROFINANCIERA: 'Microfinanciera',
  DISTRIBUIDOR: 'Distribuidor',
};

const VACIO = { entidad: '', tipo: 'BANCO' as Tipo, nombre: '', email: '' };

/**
 * Equipo de TendIA: da de alta una entidad tras su vinculación comercial. No hay registro abierto
 * porque el portal muestra datos de tenderos; el primer administrador llega por invitación, crea su
 * contraseña y activa la verificación en dos pasos, y desde Equipo invita a sus analistas.
 */
export default function AliadosPage() {
  const [aliados, setAliados] = useState<Aliado[] | null>(null);
  const [form, setForm] = useState(VACIO);
  // Entidad existente a la que se le envía otra invitación de administrador.
  const [destino, setDestino] = useState<Aliado | null>(null);
  const [nueva, setNueva] = useState<(Invitacion & { entidad: string }) | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    api<Aliado[]>('/admin/aliados')
      .then(setAliados)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopiado(false);
    setEnviando(true);
    try {
      const persona = { nombre: form.nombre, email: form.email };
      if (destino) {
        const r = await api<{ invitacion: Invitacion }>(
          `/admin/aliados/${destino.id}/invitaciones`,
          { method: 'POST', body: JSON.stringify(persona) },
        );
        setNueva({ ...r.invitacion, entidad: destino.nombre });
      } else {
        const r = await api<{ aliado: { nombre: string }; invitacion: Invitacion }>(
          '/admin/aliados',
          { method: 'POST', body: JSON.stringify(form) },
        );
        setNueva({ ...r.invitacion, entidad: r.aliado.nombre });
      }
      setForm(VACIO);
      setDestino(null);
      cargar();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Aliados"
        subtitle="Da de alta una entidad cuando firme con TendIA. Su primer administrador recibe un enlace de un solo uso, crea su contraseña, activa la verificación en dos pasos e invita a su equipo."
      />
      {error && (
        <div className="mb-4">
          <Alerta>{error}</Alerta>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card
          title={destino ? `Nuevo administrador de ${destino.nombre}` : 'Dar de alta una entidad'}
        >
          <form onSubmit={enviar} className="space-y-3">
            {!destino && (
              <>
                <Field label="Nombre de la entidad">
                  <input
                    className={inputClass}
                    required
                    minLength={3}
                    maxLength={80}
                    value={form.entidad}
                    onChange={(e) => setForm({ ...form, entidad: e.target.value })}
                  />
                </Field>
                <Field label="Tipo">
                  <select
                    className={inputClass}
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}
                  >
                    {Object.entries(TIPOS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Nombre del administrador">
              <input
                className={inputClass}
                required
                minLength={2}
                maxLength={80}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Field>
            <Field
              label="Correo del administrador"
              hint="El correo institucional de la persona que firmó con TendIA."
            >
              <input
                type="email"
                className={inputClass}
                required
                maxLength={160}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={enviando}>
                {enviando ? 'Creando…' : destino ? 'Crear invitación' : 'Dar de alta'}
              </Button>
              {destino && (
                <Button type="button" variant="secondary" onClick={() => setDestino(null)}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
          {nueva && (
            <div className="mt-4">
              <Alerta tono="success">
                Invitación de administrador de {nueva.entidad} lista para {nueva.email}. El enlace
                vence el {fecha(nueva.expiraEn)} y solo se muestra esta vez.
                <code className="mt-2 block break-all rounded bg-white p-2 text-brand-900">
                  {nueva.enlace}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={nueva.mailto}>
                    <Button type="button">Enviar por correo</Button>
                  </a>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(nueva.enlace).then(() => setCopiado(true));
                    }}
                  >
                    {copiado ? 'Copiado' : 'Copiar enlace'}
                  </Button>
                </div>
              </Alerta>
            </div>
          )}
        </Card>

        <Card title="Entidades">
          {!aliados ? (
            <Vacio>Cargando…</Vacio>
          ) : aliados.length === 0 ? (
            <Vacio>Todavía no hay entidades.</Vacio>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {aliados.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-bold text-brand-900">{a.nombre}</div>
                    <div className="text-xs text-ink-muted">
                      {TIPOS[a.tipo]} · {a.usuarios} {a.usuarios === 1 ? 'persona' : 'personas'} ·{' '}
                      {a.solicitudes} {a.solicitudes === 1 ? 'solicitud' : 'solicitudes'}
                    </div>
                    {a.invitacionesPendientes.map((i) => (
                      <div key={i.email} className="text-xs text-ink-muted">
                        Invitación pendiente: {i.email} · vence {fecha(i.expiraEn)}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {a.administradores === 0 ? (
                      <Badge tono="warning">Sin administrador</Badge>
                    ) : (
                      <Badge tono={a.conMfa === a.usuarios ? 'success' : 'warning'}>
                        {a.conMfa === a.usuarios
                          ? 'Todos con MFA'
                          : `${a.usuarios - a.conMfa} sin MFA`}
                      </Badge>
                    )}
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setDestino(a);
                        setNueva(null);
                        setForm(VACIO);
                      }}
                    >
                      Invitar administrador
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
