'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageTitle } from '@/components/Shell';
import { Alerta, Badge, Button, Card, Field, inputClass, Vacio } from '@/components/ui';
import { api } from '@/lib/api';
import { fecha } from '@/lib/format';

interface Miembro {
  id: string;
  nombre: string;
  email: string;
  rol: 'ANALISTA' | 'ADMIN_ALIADO';
  mfaActivo: boolean;
  creadoEn: string;
}
interface Pendiente {
  id: string;
  nombre: string;
  email: string;
  rol: 'ANALISTA' | 'ADMIN_ALIADO';
  expiraEn: string;
}
interface Invitacion {
  email: string;
  enlace: string;
  mailto: string;
  expiraEn: string;
}

const ROL = { ANALISTA: 'Analista', ADMIN_ALIADO: 'Administrador' } as const;

/** El administrador del aliado invita analistas por correo (TND-011). */
export default function EquipoPage() {
  const [equipo, setEquipo] = useState<{ usuarios: Miembro[]; invitaciones: Pendiente[] } | null>(
    null,
  );
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'ANALISTA' });
  const [nueva, setNueva] = useState<Invitacion | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    api<typeof equipo>('/aliado/equipo')
      .then(setEquipo)
      .catch((e: Error) => setError(e.message));
  }, []);
  useEffect(cargar, [cargar]);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCopiado(false);
    try {
      setNueva(
        await api<Invitacion>('/aliado/equipo/invitaciones', {
          method: 'POST',
          body: JSON.stringify(form),
        }),
      );
      setForm({ nombre: '', email: '', rol: 'ANALISTA' });
      cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revocar(id: string) {
    await api(`/aliado/equipo/invitaciones/${id}`, { method: 'DELETE' }).catch((e: Error) =>
      setError(e.message),
    );
    cargar();
  }

  return (
    <>
      <PageTitle
        title="Equipo"
        subtitle="Invita analistas por correo. Cada persona crea su contraseña y activa la verificación en dos pasos."
      />
      {error && (
        <div className="mb-4">
          <Alerta>{error}</Alerta>
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Invitar a una persona">
          <form onSubmit={invitar} className="space-y-3">
            <Field label="Nombre">
              <input
                className={inputClass}
                required
                minLength={2}
                maxLength={80}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </Field>
            <Field label="Correo">
              <input
                type="email"
                className={inputClass}
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Rol">
              <select
                className={inputClass}
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value })}
              >
                <option value="ANALISTA">Analista: revisa y decide solicitudes</option>
                <option value="ADMIN_ALIADO">
                  Administrador: además, política, llaves y equipo
                </option>
              </select>
            </Field>
            <Button type="submit">Crear invitación</Button>
          </form>
          {nueva && (
            <div className="mt-4">
              <Alerta tono="success">
                Invitación lista para {nueva.email}. El enlace vence el {fecha(nueva.expiraEn)} y
                solo se muestra esta vez.
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

        <Card title="Personas con acceso">
          {!equipo ? (
            <Vacio>Cargando…</Vacio>
          ) : (
            <div className="space-y-5">
              <ul className="divide-y divide-line text-sm">
                {equipo.usuarios.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <div className="font-bold text-brand-900">{u.nombre}</div>
                      <div className="text-xs text-ink-muted">
                        {u.email} · desde {fecha(u.creadoEn)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge tono="info">{ROL[u.rol]}</Badge>
                      <Badge tono={u.mfaActivo ? 'success' : 'warning'}>
                        {u.mfaActivo ? 'MFA activo' : 'Sin MFA'}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
              {equipo.invitaciones.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase text-ink-muted">
                    Invitaciones pendientes
                  </h3>
                  <ul className="divide-y divide-line text-sm">
                    {equipo.invitaciones.map((i) => (
                      <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <div className="font-bold text-brand-900">{i.nombre}</div>
                          <div className="text-xs text-ink-muted">
                            {i.email} · {ROL[i.rol]} · vence {fecha(i.expiraEn)}
                          </div>
                        </div>
                        <Button variant="danger" onClick={() => revocar(i.id)}>
                          Anular
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
