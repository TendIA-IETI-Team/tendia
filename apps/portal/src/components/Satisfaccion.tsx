import { Card, Vacio } from '@/components/ui';
import { fecha } from '@/lib/format';

/** Respuestas a la pregunta de satisfacción (TND-081). */
export interface Satisfaccion {
  respuestas: number;
  promedio: number | null;
  distribucion: { calificacion: number; respuestas: number }[];
  comentarios: {
    calificacion: number;
    comentario: string;
    estado: string;
    aliado: string | null;
    fecha: string | null;
  }[];
}

/** Promedio, distribución de 1 a 5 y comentarios recientes. */
export function TableroSatisfaccion({
  datos,
  conAliado = false,
}: {
  datos: Satisfaccion;
  conAliado?: boolean;
}) {
  const max = Math.max(1, ...datos.distribucion.map((d) => d.respuestas));
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Calificación">
        {datos.respuestas === 0 ? (
          <Vacio>Todavía no hay respuestas.</Vacio>
        ) : (
          <>
            <div className="mb-5 flex items-end gap-8">
              <div>
                <div className="tabular text-4xl font-extrabold text-brand-700">
                  {datos.promedio?.toLocaleString('es-CO')}
                </div>
                <div className="text-xs font-bold uppercase text-ink-muted">Promedio de 5</div>
              </div>
              <div>
                <div className="tabular text-4xl font-extrabold text-brand-700">
                  {datos.respuestas}
                </div>
                <div className="text-xs font-bold uppercase text-ink-muted">Respuestas</div>
              </div>
            </div>
            <ul className="space-y-2" aria-label="Respuestas por calificación">
              {[...datos.distribucion].reverse().map((d) => (
                <li key={d.calificacion} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 whitespace-nowrap font-bold text-brand-900">
                    {d.calificacion} {d.calificacion === 1 ? 'estrella' : 'estrellas'}
                  </span>
                  <span className="h-3 flex-1 rounded-full bg-brand-50">
                    <span
                      className="block h-3 rounded-full bg-brand-500"
                      style={{ width: `${(d.respuestas / max) * 100}%` }}
                    />
                  </span>
                  <span className="tabular w-8 text-right text-ink-muted">{d.respuestas}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <Card title="Comentarios recientes">
        {datos.comentarios.length === 0 ? (
          <Vacio>Sin comentarios.</Vacio>
        ) : (
          <ul className="space-y-3 text-sm">
            {datos.comentarios.map((c, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="mb-1 text-xs font-bold text-ink-muted">
                  {'★'.repeat(c.calificacion)}
                  {'☆'.repeat(5 - c.calificacion)} · {fecha(c.fecha)}
                  {conAliado && c.aliado ? ` · ${c.aliado}` : ''}
                </div>
                <p className="text-brand-900">{c.comentario}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
