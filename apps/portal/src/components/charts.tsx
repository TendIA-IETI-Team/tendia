'use client';

import { chartColors } from '@tendia/tokens';
import { useState } from 'react';
import type { Contribucion } from '@/lib/api';
import { fecha, mesCorto, millones, pesos } from '@/lib/format';

/** Tooltip HTML posicionado sobre el gráfico. */
function Tip({ left, children }: { left: string; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-brand-900 px-3 py-2 text-xs text-white shadow-lg"
      style={{ left, top: -8 }}
    >
      {children}
    </div>
  );
}

/**
 * Ventas mensuales (una sola serie: sin leyenda de serie). Los meses que el tendero
 * justificó se resaltan en naranja con su etiqueta: resaltar, no "malo".
 */
export function VentasChart({
  datos,
  justificados,
}: {
  datos: { mes: string; ventas: number }[];
  justificados: { mes: string; motivo: string }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!datos.length) return null;
  const W = 640;
  const H = 220;
  const pad = { top: 16, right: 8, bottom: 28, left: 44 };
  const max = Math.max(...datos.map((d) => d.ventas)) * 1.1;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / datos.length;
  const barW = Math.min(36, slot - 6);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max].map((t) => Math.round(t / 1_000_000) * 1_000_000);
  const motivo = (mes: string) => justificados.find((j) => j.mes === mes)?.motivo;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ventas por mes">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke={chartColors.grid} />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5F5B73">
              {millones(t)}
            </text>
          </g>
        ))}
        {datos.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const just = Boolean(motivo(d.mes));
          const h = Math.max(2, pad.top + innerH - y(d.ventas));
          return (
            <g key={d.mes} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Zona de hover más grande que la barra */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
              />
              <path
                d={`M${x},${pad.top + innerH} v${-(h - 4)} q0,-4 4,-4 h${barW - 8} q4,0 4,4 v${h - 4} z`}
                fill={just ? chartColors.highlight : chartColors.primary}
                opacity={hover === null || hover === i ? 1 : 0.55}
              />
              <text
                x={x + barW / 2}
                y={H - 10}
                textAnchor="middle"
                fontSize="11"
                fill={just ? '#B4501E' : '#5F5B73'}
                fontWeight={just ? 700 : 400}
              >
                {mesCorto(d.mes)}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip left={`${((pad.left + hover * slot + slot / 2) / W) * 100}%`}>
          <div className="font-bold">{mesCorto(datos[hover].mes)}</div>
          <div className="tabular">{pesos(datos[hover].ventas)}</div>
          {motivo(datos[hover].mes) && (
            <div className="mt-1 max-w-56 whitespace-normal">
              Justificado: {motivo(datos[hover].mes)}
            </div>
          )}
        </Tip>
      )}
      {justificados.length > 0 && (
        <figcaption className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ background: chartColors.highlight }}
          />
          Mes justificado por el tendero (no cuenta para estabilidad ni tendencia)
        </figcaption>
      )}
    </figure>
  );
}

/** Puntos con signo; los valores que redondean a cero se muestran como 0. */
export function puntos(p: number, decimales = 1): string {
  const r = Number(p.toFixed(decimales));
  if (r === 0) return (0).toFixed(decimales);
  return `${r > 0 ? '+' : ''}${r.toFixed(decimales)}`;
}

/**
 * Contribuciones en puntos frente a un negocio promedio. Divergente desde cero:
 * suma en índigo, resta en magenta, siempre con el signo y el valor escrito.
 */
export function ContribucionesChart({ contribuciones }: { contribuciones: Contribucion[] }) {
  const max = Math.max(1, ...contribuciones.map((c) => Math.abs(c.points)));
  return (
    <ul className="space-y-2.5" aria-label="Factores del puntaje">
      {contribuciones.map((c) => {
        const pct = (Math.abs(c.points) / max) * 50;
        const suma = c.points >= 0;
        return (
          <li
            key={c.feature}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_3.5rem] items-center gap-3 text-sm"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-brand-900" title={c.label}>
                {c.label}
              </div>
              <div className="tabular text-xs text-ink-muted">{c.display_value}</div>
            </div>
            <div className="relative h-3.5" title={`${c.label}: ${puntos(c.points)} puntos`}>
              <div className="absolute left-1/2 top-[-3px] h-5 w-px bg-line" />
              <div
                className="absolute top-0 h-full"
                style={{
                  left: suma ? '50%' : `${50 - pct}%`,
                  width: `${Math.max(pct, 0.6)}%`,
                  background: suma ? chartColors.primary : chartColors.negative,
                  borderRadius: suma ? '0 4px 4px 0' : '4px 0 0 4px',
                }}
              />
            </div>
            <div
              className={`tabular text-right font-bold ${suma ? 'text-brand-700' : 'text-[#8E3560]'}`}
            >
              {puntos(c.points)}
            </div>
          </li>
        );
      })}
      <li className="flex justify-center gap-6 pt-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: chartColors.negative }}
          />
          Resta puntos
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: chartColors.primary }}
          />
          Suma puntos
        </span>
      </li>
    </ul>
  );
}

/** Consultas por día a la API pública (una serie). */
export function ConsumoChart({
  porDia,
}: {
  porDia: { dia: string; consultas: number; exitosas: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!porDia.length) return null;
  const W = 640;
  const H = 160;
  const pad = { top: 12, bottom: 24, left: 32, right: 8 };
  const max = Math.max(4, ...porDia.map((d) => d.consultas));
  const innerH = H - pad.top - pad.bottom;
  const slot = (W - pad.left - pad.right) / porDia.length;
  const barW = Math.min(28, slot - 4);
  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Consultas a la API por día"
      >
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + innerH}
          y2={pad.top + innerH}
          stroke={chartColors.grid}
        />
        <text x={pad.left - 6} y={pad.top + 8} textAnchor="end" fontSize="11" fill="#5F5B73">
          {max}
        </text>
        {porDia.map((d, i) => {
          const h = Math.max(2, (d.consultas / max) * innerH);
          const x = pad.left + i * slot + (slot - barW) / 2;
          return (
            <g key={d.dia} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
              />
              <rect
                x={x}
                y={pad.top + innerH - h}
                width={barW}
                height={h}
                rx={4}
                fill={chartColors.primary}
              />
              {(i === 0 || i === porDia.length - 1) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#5F5B73">
                  {fecha(d.dia + 'T12:00:00')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip left={`${((pad.left + hover * slot + slot / 2) / W) * 100}%`}>
          <div className="font-bold">{fecha(porDia[hover].dia + 'T12:00:00')}</div>
          <div className="tabular">
            {porDia[hover].consultas} consultas · {porDia[hover].exitosas} exitosas
          </div>
        </Tip>
      )}
    </figure>
  );
}
