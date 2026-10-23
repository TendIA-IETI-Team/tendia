import type { Config } from 'tailwindcss';
import { chartColors, colors } from '../../packages/tokens/src/index';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          900: colors.indigo900,
          700: colors.indigo700,
          500: colors.indigo500,
          300: colors.indigo300,
          100: colors.indigo100,
          50: colors.indigo50,
        },
        accent: { 500: colors.orange500, 700: colors.orange700, 100: colors.orange100 },
        ink: { DEFAULT: colors.indigo900, muted: colors.neutral600 },
        line: colors.neutral300,
        success: { DEFAULT: colors.success, bg: colors.successBg },
        warning: { DEFAULT: colors.warning, bg: colors.warningBg },
        danger: { DEFAULT: colors.danger, bg: colors.dangerBg },
        chart: chartColors,
      },
      fontFamily: { sans: ['var(--font-nunito)', 'system-ui', 'sans-serif'] },
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
} satisfies Config;
