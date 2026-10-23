'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_URL, session, type Usuario } from '@/lib/api';

const NAV = [
  { href: '/bandeja', label: 'Solicitudes', admin: false },
  { href: '/politica', label: 'Política de riesgo', admin: false },
  { href: '/integraciones', label: 'API y consumo', admin: false },
  { href: '/auditoria', label: 'Auditoría', admin: true },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    const u = session.usuario;
    if (!session.token || !u) router.replace('/login');
    else setUsuario(u);
  }, [router]);

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
            <div className="text-xs text-brand-100">Portal del aliado</div>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0"
          aria-label="Principal"
        >
          {NAV.filter((n) => !n.admin || usuario.rol === 'ADMIN_ALIADO').map((n) => {
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
        </nav>
        <div className="mt-auto hidden border-t border-brand-500 px-5 py-4 text-sm md:block">
          <div className="font-bold">{usuario.nombre}</div>
          <div className="text-xs text-brand-100">
            {usuario.rol === 'ADMIN_ALIADO' ? 'Administrador' : 'Analista'}
          </div>
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
