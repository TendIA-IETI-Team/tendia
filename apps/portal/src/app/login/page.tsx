'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useState } from 'react';
import { Alerta, Button, Field, inputClass } from '@/components/ui';
import { api, session, type Usuario } from '@/lib/api';

interface LoginResp {
  mfaRequerido: true;
  mfaToken: string;
  configurarMfa?: boolean;
  secreto?: string;
  otpauthUrl?: string;
}

/** Ingreso del analista con correo, contraseña y MFA obligatorio (TND-011). */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [paso, setPaso] = useState<LoginResp | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const r = await api<LoginResp>('/auth/aliado/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (r.otpauthUrl) setQr(await QRCode.toDataURL(r.otpauthUrl, { margin: 1, width: 180 }));
      setPaso(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCargando(false);
    }
  }

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (!paso) return;
    setError(null);
    setCargando(true);
    try {
      const r = await api<{ accessToken: string; usuario: Usuario }>('/auth/aliado/mfa', {
        method: 'POST',
        body: JSON.stringify({ mfaToken: paso.mfaToken, codigo }),
      });
      session.save(r.accessToken, r.usuario);
      router.replace('/bandeja');
    } catch (err) {
      setError((err as Error).message);
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
          {!paso ? (
            <form onSubmit={login} className="space-y-4">
              <h1 className="text-xl font-extrabold text-brand-900">Ingresa a tu cuenta</h1>
              <Field label="Correo">
                <input
                  className={inputClass}
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Contraseña">
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && <Alerta>{error}</Alerta>}
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando ? 'Verificando…' : 'Continuar'}
              </Button>
            </form>
          ) : (
            <form onSubmit={verificar} className="space-y-4">
              <h1 className="text-xl font-extrabold text-brand-900">
                {paso.configurarMfa
                  ? 'Activa la verificación en dos pasos'
                  : 'Verificación en dos pasos'}
              </h1>
              {paso.configurarMfa && (
                <div className="space-y-3 text-sm text-ink-muted">
                  <p>
                    Escanea este código con Google Authenticator, Microsoft Authenticator o similar.
                  </p>
                  {qr && (
                    <img
                      src={qr}
                      alt="Código QR para la app de autenticación"
                      className="mx-auto rounded-lg border border-line"
                      width={180}
                      height={180}
                    />
                  )}
                  <p>
                    ¿No puedes escanear? Escribe esta clave:{' '}
                    <code className="break-all rounded bg-brand-50 px-1.5 py-0.5 font-bold text-brand-700">
                      {paso.secreto}
                    </code>
                  </p>
                </div>
              )}
              <Field
                label="Código de 6 dígitos"
                hint="Lo muestra tu app de autenticación y cambia cada 30 segundos."
              >
                <input
                  className={`${inputClass} tabular text-center text-xl tracking-[0.4em]`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              {error && <Alerta>{error}</Alerta>}
              <Button type="submit" className="w-full" disabled={cargando || codigo.length !== 6}>
                {cargando ? 'Verificando…' : 'Ingresar'}
              </Button>
              <button
                type="button"
                className="w-full text-sm font-semibold text-brand-500 underline"
                onClick={() => {
                  setPaso(null);
                  setCodigo('');
                }}
              >
                Volver
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-ink-muted">
          TendIA no presta dinero: evalúa el negocio y comparte un puntaje explicado.
        </p>
      </div>
    </main>
  );
}
