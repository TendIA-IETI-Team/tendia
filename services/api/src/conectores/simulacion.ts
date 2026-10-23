/**
 * Simulación determinística de un negocio para los conectores simulados (TND-030, TND-031).
 * Mismas reglas que services/scoring/tendia_scoring/synthetic.py: el mismo negocio siempre
 * devuelve el mismo historial, y datáfono y distribuidor son coherentes entre sí.
 */
import type { NegocioRef } from './conector';

export interface MesSimulado {
  mes: string;
  ventas: number;
  compras: number;
  facturas: number;
  pagadasATiempo: number;
  diasRetrasoPromedio: number;
}

interface Perfil {
  calidad: number;
  mesesHistoria: number;
  caidaEnero: boolean;
}

const PERFILES: Record<string, Perfil> = {
  bueno: { calidad: 1.4, mesesHistoria: 24, caidaEnero: false },
  estacional: { calidad: 0.4, mesesHistoria: 24, caidaEnero: true },
  riesgoso: { calidad: -1.5, mesesHistoria: 24, caidaEnero: false },
  nuevo: { calidad: 0.5, mesesHistoria: 4, caidaEnero: false },
};

const ESTACIONALIDAD: Record<number, number> = {
  1: 0.8,
  2: 0.92,
  4: 0.93,
  5: 0.92,
  10: 0.94,
  11: 0.96,
  12: 1.25,
};

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG mulberry32: rápido y reproducible. */
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, gauss };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function monthAdd(month: string, delta: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export function lastClosedMonth(now = new Date()): string {
  return monthAdd(`${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, -1);
}

export function perfilDe(negocio: NegocioRef): Perfil {
  const fixed = negocio.perfilSimulado ? PERFILES[negocio.perfilSimulado] : undefined;
  if (fixed) return fixed;
  const r = rng(hashSeed(`perfil:${negocio.id}`));
  return { calidad: r.gauss(), mesesHistoria: 24, caidaEnero: false };
}

export function simularNegocio(negocio: NegocioRef, meses: number, hasta: string): MesSimulado[] {
  const perfil = perfilDe(negocio);
  const r = rng(hashSeed(`historial:${negocio.id}`));
  const q = perfil.calidad;
  const base = Math.exp(Math.log(9_000_000) + 0.5 * r.gauss());
  const tendencia = 0.012 * q + 0.01 * r.gauss();
  const ruido = 0.06 + 0.16 * sigmoid(-1.3 * q);
  const pagoATiempo = sigmoid(1.9 + 1.4 * q);
  const margen = Math.min(1.4, Math.max(0.35, 0.72 + 0.05 * r.gauss() - 0.06 * q));

  const n = Math.min(meses, perfil.mesesHistoria);
  const out: MesSimulado[] = [];
  for (let i = 0; i < n; i++) {
    const mes = monthAdd(hasta, -(n - 1 - i));
    const mesNum = Number(mes.slice(5, 7));
    let ventas = base * (ESTACIONALIDAD[mesNum] ?? 1) * (1 + tendencia) ** i;
    ventas *= Math.max(0.05, 1 + ruido * r.gauss());
    if (perfil.caidaEnero && mesNum === 1) ventas *= 0.42; // obras en la calle en enero
    const facturas = 3 + Math.floor(r.next() * 6);
    let pagadas = 0;
    for (let f = 0; f < facturas; f++) if (r.next() < pagoATiempo) pagadas++;
    const retraso =
      pagadas < facturas ? -Math.log(Math.max(r.next(), 1e-9)) * (3 + 12 * sigmoid(-q)) : 0;
    out.push({
      mes,
      ventas: Math.round(ventas / 1000) * 1000,
      compras: Math.round((ventas * margen * (0.9 + 0.2 * r.next())) / 1000) * 1000,
      facturas,
      pagadasATiempo: pagadas,
      diasRetrasoPromedio: Math.round(retraso * 10) / 10,
    });
  }
  return out;
}
