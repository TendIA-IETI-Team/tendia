/**
 * Paleta derivada del logo: índigo #362D7C (la casa) y naranja #F38B54 (la chispa).
 * Reglas (ver docs/brand.md):
 * - Nunca texto blanco sobre naranja (2.4:1). Sobre naranja va texto indigo900.
 * - El naranja nunca significa error ni "mal score".
 */
export const colors = {
  indigo900: '#1F1A4D',
  indigo700: '#362D7C',
  indigo500: '#5B4FB0',
  indigo300: '#9C93E0',
  indigo100: '#EEEBFA',
  indigo50: '#F7F5FC',
  orange500: '#F38B54',
  orange700: '#B4501E',
  orange100: '#FDEDE3',
  neutral600: '#5F5B73',
  neutral300: '#D9D6E3',
  white: '#FFFFFF',
  success: '#1E7F4F',
  successBg: '#E5F4EC',
  warning: '#9A6700',
  warningBg: '#FBF1DC',
  danger: '#B3261E',
  dangerBg: '#FBEAE9',
  darkBg: '#14112E',
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Colores de marcas en gráficos, validados con el validador de paletas (banda de luminosidad,
 * croma, separación para daltonismo y contraste 3:1 sobre fondo claro). Los valores siempre
 * llevan etiqueta: el color nunca es la única señal.
 */
export const chartColors = {
  primary: '#5B4FB0', // serie principal, factores que suman
  highlight: '#D06B2C', // mes justificado por el tendero (resaltar, no "malo")
  negative: '#B5487A', // factores que restan puntos
  grid: '#E6E3EF',
} as const;

/** Rampa índigo para los 5 niveles del Puntaje TendIA (de menor a mayor). */
export const scoreLevelColors = [
  colors.indigo300,
  '#7D72CC',
  colors.indigo500,
  '#4537A0',
  colors.indigo700,
] as const;

export const fonts = {
  family: 'Nunito',
  bodyMobile: 18,
  bodyPortal: 16,
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/** Contraste WCAG 2.1 entre dos colores hex (#RRGGBB). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
