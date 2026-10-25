# Identidad visual

La paleta sale del logo: **índigo `#362D7C`** (la casa) y **naranja `#F38B54`** (la chispa). La fuente única es [`packages/tokens`](../packages/tokens/src/index.ts), que usan la app y el portal, y sus pruebas verifican el contraste WCAG AA.

| Token                                      | Hex                               | Uso                                                              |
| ------------------------------------------ | --------------------------------- | ---------------------------------------------------------------- |
| `indigo900`                                | `#1F1A4D`                         | Texto principal                                                  |
| `indigo700`                                | `#362D7C`                         | Marca, botones primarios                                         |
| `indigo500`                                | `#5B4FB0`                         | Hover, enlaces, foco                                             |
| `indigo100` / `indigo50`                   | `#EEEBFA` / `#F7F5FC`             | Superficies y fondo                                              |
| `orange500`                                | `#F38B54`                         | Acento: un CTA destacado, logros                                 |
| `orange700`                                | `#B4501E`                         | Naranja para texto sobre fondo claro                             |
| `success` / `warning` / `danger`           | `#1B7346` / `#875A00` / `#B3261E` | Estados, siempre con texto; ≥ 4,5:1 también sobre su fondo claro |
| `chart.primary` / `highlight` / `negative` | `#5B4FB0` / `#D06B2C` / `#B5487A` | Gráficos, validados para daltonismo                              |

## Reglas

1. **Nunca texto blanco sobre naranja** (2,4:1). Sobre naranja va `indigo900` (6,6:1).
2. **El naranja nunca significa "malo".** Los niveles del puntaje usan una rampa de índigo con su nombre escrito. Un puntaje bajo es "En construcción".
3. **Nunca solo color:** cada estado y cada barra lleva texto o signo.
4. **Tipografía Nunito**, con cuerpo de 18 px en la app y 16 px en el portal, y números tabulares en montos y puntajes.
5. **Lenguaje simple** (hallazgos con doña Gloria): "ventas con datáfono" en vez de "POS", "cuentas del banco" en vez de "open finance", "respaldo del Fondo Nacional de Garantías" en vez de "aval FNG". Siempre aclarar que TendIA no presta dinero.
