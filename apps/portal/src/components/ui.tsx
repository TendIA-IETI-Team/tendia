import { CORTES_NIVEL, ESTADOS, NIVELES } from '@/lib/format';
import { scoreLevelColors } from '@tendia/tokens';

export function Card({
  title,
  action,
  children,
  className = '',
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card border border-line bg-white p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          {title && <h2 className="text-base font-bold text-brand-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONOS = {
  info: 'bg-brand-100 text-brand-700',
  warning: 'bg-warning-bg text-warning',
  success: 'bg-success-bg text-success',
  danger: 'bg-danger-bg text-danger',
  neutral: 'bg-brand-50 text-ink-muted',
};

export function Badge({
  tono = 'neutral',
  children,
}: {
  tono?: keyof typeof TONOS;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { texto: estado, tono: 'info' as const };
  return <Badge tono={e.tono}>{e.texto}</Badge>;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-brand-700 text-white hover:bg-brand-900',
    secondary: 'border border-line bg-white text-brand-700 hover:bg-brand-50',
    // Sobre naranja va texto índigo oscuro: el blanco no pasa contraste AA.
    accent: 'bg-accent-500 text-brand-900 hover:brightness-95',
    danger: 'border border-danger text-danger bg-white hover:bg-danger-bg',
  }[variant];
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-brand-900">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-ink focus:border-brand-500 focus:outline-none';

export function Alerta({
  tono = 'danger',
  children,
}: {
  tono?: 'danger' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
}) {
  const s = {
    danger: 'border-danger bg-danger-bg text-danger',
    warning: 'border-warning bg-warning-bg text-warning',
    success: 'border-success bg-success-bg text-success',
    info: 'border-brand-300 bg-brand-100 text-brand-700',
  }[tono];
  return (
    <div
      role={tono === 'danger' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm font-semibold ${s}`}
    >
      {children}
    </div>
  );
}

/**
 * Puntaje como número héroe + barra de 5 niveles. Los niveles usan una rampa de índigo
 * (nunca rojo/verde ni naranja) y siempre llevan nombre: el color no es la única señal.
 */
export function ScoreHero({
  puntaje,
  nivel,
  compacto = false,
}: {
  puntaje: number;
  nivel: string;
  compacto?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          className={`tabular font-extrabold text-brand-700 ${compacto ? 'text-3xl' : 'text-5xl'}`}
        >
          {puntaje}
        </span>
        <span className="text-sm text-ink-muted">de 100</span>
        <Badge tono="info">{nivel}</Badge>
      </div>
      {!compacto && (
        <div className="mt-3" aria-hidden="true">
          <div className="relative flex h-2.5 gap-0.5">
            {NIVELES.map((n, i) => (
              <div
                key={n}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{
                  width: `${CORTES_NIVEL[i + 1] - CORTES_NIVEL[i]}%`,
                  background: scoreLevelColors[i],
                }}
              />
            ))}
            <div
              className="absolute -top-1 h-4.5 w-1 rounded-full bg-brand-900 ring-2 ring-white"
              style={{ left: `calc(${puntaje}% - 2px)`, height: 18 }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
            <span>0 · {NIVELES[0]}</span>
            <span>{NIVELES[NIVELES.length - 1]} · 100</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-center text-sm text-ink-muted">{children}</p>;
}
