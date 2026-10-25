'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { API_URL, session, type Rol, type Usuario } from '@/lib/api';

/** Model card (TND-047) y política de datos (TND-023), publicadas en el repo. */
const DOCS = 'https://github.com/TendIA-IETI-Team/tendia/blob/main/docs';

const ALIADO: Rol[] = ['ANALISTA', 'ADMIN_ALIADO'];

const NAV: { href: string; label: string; roles: Rol[] }[] = [
  { href: '/bandeja', label: 'Solicitudes', roles: ALIADO },
  { href: '/politica', label: 'Política de riesgo', roles: ALIADO },
  { href: '/integraciones', label: 'API y consumo', roles: ALIADO },
  { href: '/satisfaccion', label: 'Satisfacción', roles: ALIADO },
  { href: '/equipo', label: 'Equipo', roles: ['ADMIN_ALIADO'] },
  { href: '/auditoria', label: 'Auditoría', roles: ['ADMIN_ALIADO'] },
  { href: '/admin', label: 'Bitácora por tendero', roles: ['ADMIN_TENDIA'] },
];

const ROLES: Record<Rol, string> = {
  ANALISTA: 'Analista',
  ADMIN_ALIADO: 'Administrador',
  ADMIN_TENDIA: 'Equipo TendIA',
};

const sinSuscripcion = () => () => undefined;

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  // La sesión vive en sessionStorage: en el servidor no hay sesión y el cliente la lee al hidratar.
  const raw = useSyncExternalStore(
    sinSuscripcion,
    () => session.usuarioGuardado,
    () => undefined,
  );
  const usuario = useMemo<Usuario | null>(() => (raw ? JSON.parse(raw) : null), [raw]);

  useEffect(() => {
    if (raw === null) router.replace('/login');
  }, [raw, router]);

  // Cada rol solo ve sus pantallas: el equipo de TendIA no entra a la bandeja de un aliado.
  useEffect(() => {
    if (!usuario) return;
    const enAdmin = path.startsWith('/admin');
    if (usuario.rol === 'ADMIN_TENDIA' && !enAdmin) router.replace('/admin');
    if (usuario.rol !== 'ADMIN_TENDIA' && enAdmin) router.replace('/bandeja');
  }, [usuario, path, router]);

  if (!usuario) return null;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-brand-700 text-white md:w-60">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="rounded-lg bg-white p-1">
            <Image src="/logo.png" alt="" width={32} height={32} />
          </div>
          <div>
            <div className="text-lg font-extrabold leading-none">TendIA</div>
            <div className="text-xs text-brand-100">
              {usuario.rol === 'ADMIN_TENDIA' ? 'Administración' : 'Portal del aliado'}
            </div>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0"
          aria-label="Principal"
        >
          {NAV.filter((n) => n.roles.includes(usuario.rol)).map((n) => {
            const active =
              path.startsWith(n.href) || (n.href === '/bandeja' && path.startsWith('/solicitudes'));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                  active
                    ? 'bg-white text-brand-700'
                    : 'text-brand-100 hover:bg-brand-500 hover:text-white'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-500 hover:text-white"
          >
            Documentación API ↗
          </a>
          <a
            href={`${DOCS}/model-card.md`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-500 hover:text-white"
          >
            Model card ↗
          </a>
          <a
            href={`${DOCS}/legal/politica-tratamiento-datos.md`}
            target="_blank"
            rel="noreferrer"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-500 hover:text-white"
          >
            Política de datos ↗
          </a>
        </nav>
        <div className="mt-auto hidden border-t border-brand-500 px-5 py-4 text-sm md:block">
          <div className="font-bold">{usuario.nombre}</div>
          <div className="text-xs text-brand-100">{ROLES[usuario.rol]}</div>
          <button
            className="mt-3 text-xs font-bold text-white underline"
            onClick={() => {
              session.clear();
              router.replace('/login');
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
