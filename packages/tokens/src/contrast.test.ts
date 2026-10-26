import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colors, contrastRatio } from './index.ts';

const AA = 4.5;

const textPairs: Array<[string, string, string]> = [
  ['texto principal sobre blanco', colors.indigo900, colors.white],
  ['blanco sobre botón primario', colors.white, colors.indigo700],
  ['texto índigo sobre fondo de app', colors.indigo900, colors.indigo50],
  ['texto sobre botón de acento', colors.indigo900, colors.orange500],
  ['naranja de texto sobre blanco', colors.orange700, colors.white],
  ['texto secundario sobre blanco', colors.neutral600, colors.white],
  ['éxito sobre blanco', colors.success, colors.white],
  ['advertencia sobre blanco', colors.warning, colors.white],
  ['peligro sobre blanco', colors.danger, colors.white],
  // Avisos de la app y franjas del puntaje: texto de estado sobre su fondo claro.
  ['éxito sobre su fondo', colors.success, colors.successBg],
  ['advertencia sobre su fondo', colors.warning, colors.warningBg],
  ['peligro sobre su fondo', colors.danger, colors.dangerBg],
  ['índigo sobre aviso informativo', colors.indigo700, colors.indigo100],
];

for (const [name, fg, bg] of textPairs) {
  test(`contraste AA: ${name}`, () => {
    assert.ok(
      contrastRatio(fg, bg) >= AA,
      `${fg} sobre ${bg} = ${contrastRatio(fg, bg).toFixed(2)}`,
    );
  });
}

test('texto blanco sobre naranja NO pasa AA (regla de marca)', () => {
  assert.ok(contrastRatio(colors.white, colors.orange500) < AA);
});
