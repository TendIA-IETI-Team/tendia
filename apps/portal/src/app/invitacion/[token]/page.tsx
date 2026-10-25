'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Alerta, Button, Field, inputClass } from '@/components/ui';
import { api } from '@/lib/api';

interface Invitacion {
  email: string;
  nombre: string;
  rol: 'ANALISTA' | 'ADMIN_ALIADO';
  aliado: string;
}

/** El analista invitado crea su contraseña; al entrar activa la verificación en dos pasos (TND-011). */
export default function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [inv, setInv] = useState<Invitacion | null>(null);
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api<Invitacion>(`/auth/invitacion/${encodeURIComponent(token)}`)
      .then(setInv)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    setCargando(true);
    try {
      await api(`/auth/invitacion/${encodeURIComponent(token)}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setLista(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="" width={56} height={56} priority />
          <div>
            <div className="text-3xl font-extrabold text-brand-700">TendIA</div>
            <div className="text-sm text-ink-muted">Portal del aliado</div>
          </div>
        </div>
        <div className="rounded-card border border-line bg-white p-6 shadow-sm">
          {lista ? (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold text-brand-900">Tu cuenta está lista</h1>
              <p className="text-sm text-ink-muted">
                Ingresa con {inv?.email}. Te pediremos escanear un código QR con tu app de
                autenticación para activar la verificación en dos pasos.
              </p>
              <Link href="/login">
                <Button className="w-full">Ir a ingresar</Button>
              </Link>
            </div>
          ) : !inv ? (
            error ? (
              <div className="space-y-4">
                <h1 className="text-xl font-extrabold text-brand-900">Invitación no válida</h1>
                <Alerta>{error}</Alerta>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Cargando invitación…</p>
            )
          ) : (
            <form onSubmit={crear} className="space-y-4">
              <h1 className="text-xl font-extrabold text-brand-900">Hola, {inv.nombre}</h1>
              <p className="text-sm text-ink-muted">
                {`${inv.aliado} te invitó como ${inv.rol === 'ADMIN_ALIADO' ? 'administrador' : 'analista'}. Crea tu contraseña para ${inv.email}.`}
              </p>
              <Field label="Contraseña" hint="Mínimo 12 caracteres, con letras y números.">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field label="Repite la contraseña">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                />
              </Field>
              {error && <Alerta>{error}</Alerta>}
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando ? 'Creando…' : 'Crear mi cuenta'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
