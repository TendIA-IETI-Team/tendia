import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Chips } from '@/components/chips';
import { Aviso, Body, Button, Input, Label, Pasos, Screen, Title } from '@/components/ui';
import { api, type Perfil } from '@/lib/api';
import { pesos, soloDigitos } from '@/lib/format';

const MONTOS = [1_000_000, 2_000_000, 3_000_000, 5_000_000] as const;
const DESTINOS = [
  'Surtir la tienda',
  'Pagar el arriendo',
  'Comprar equipos (nevera, vitrina)',
  'Otro',
] as const;
const PLAZOS = [3, 6, 12] as const;
const ANTIGUEDAD = {
  'Menos de 1 año': 6,
  '1 a 3 años': 24,
  '3 a 5 años': 48,
  'Más de 5 años': 84,
} as const;
type Antiguedad = keyof typeof ANTIGUEDAD;

/** T1: solicitar crédito con monto y destino (TND-050). */
export default function Solicitar() {
  const [monto, setMonto] = useState('');
  const [destino, setDestino] = useState<(typeof DESTINOS)[number] | null>(null);
  const [otro, setOtro] = useState('');
  const [plazo, setPlazo] = useState<(typeof PLAZOS)[number] | null>(6);
  const [antiguedad, setAntiguedad] = useState<Antiguedad | null>(null);
  const [pideAntiguedad, setPideAntiguedad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api<Perfil>('/me')
      .then((p) => setPideAntiguedad(!p.negocio?.antiguedadMeses))
      .catch(() => undefined);
  }, []);
  const valor = soloDigitos(monto);
  const destinoFinal = destino === 'Otro' ? otro.trim() : destino;
  const valido =
    valor >= 200_000 &&
    valor <= 50_000_000 &&
    Boolean(destinoFinal && destinoFinal.length >= 3) &&
    plazo &&
    (!pideAntiguedad || antiguedad);

  const faltantes = [
    !(valor >= 200_000 && valor <= 50_000_000) && 'el monto',
    !(destinoFinal && destinoFinal.length >= 3) && 'para qué es',
    !plazo && 'el plazo',
    pideAntiguedad && !antiguedad && 'hace cuánto abriste',
  ].filter(Boolean) as string[];

  async function crear() {
    setError(null);
    setCargando(true);
    try {
      if (pideAntiguedad && antiguedad) {
        await api('/me/negocio', {
          method: 'PUT',
          body: { antiguedadMeses: ANTIGUEDAD[antiguedad] },
        });
      }
      await api('/solicitudes', {
        method: 'POST',
        body: { monto: valor, destino: destinoFinal, plazoMeses: plazo },
      });
      router.replace('/autorizar');
    } catch (e) {
      setError((e as Error).message);
      setCargando(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          {!valido && faltantes.length > 0 && (
            <Body muted style={{ fontSize: 15, textAlign: 'center' }}>
              Falta: {faltantes.join(', ')}.
            </Body>
          )}
          <Button
            testID="siguiente"
            title="Siguiente"
            onPress={crear}
            disabled={!valido}
            loading={cargando}
          />
        </>
      }
    >
      <Pasos actual={1} />
      <Title>¿Cuánto necesitas?</Title>
      <Input
        testID="monto"
        label="Monto en pesos"
        placeholder="$3.000.000"
        keyboardType="number-pad"
        value={valor ? pesos(valor) : ''}
        onChangeText={setMonto}
        hint="Entre $200.000 y $50.000.000"
      />
      <Chips
        opciones={MONTOS}
        valor={MONTOS.find((m) => m === valor) ?? null}
        onChange={(m) => setMonto(String(m))}
        etiqueta={pesos}
      />
      <Label>¿Para qué es?</Label>
      <Chips opciones={DESTINOS} valor={destino} onChange={setDestino} />
      {destino === 'Otro' && (
        <Input label="Cuéntanos para qué" value={otro} onChangeText={setOtro} maxLength={200} />
      )}
      <Label>¿En cuántos meses quieres pagarlo?</Label>
      <Chips opciones={PLAZOS} valor={plazo} onChange={setPlazo} etiqueta={(p) => `${p} meses`} />
      {pideAntiguedad && (
        <>
          <Label>¿Hace cuánto abriste tu tienda?</Label>
          <Chips
            opciones={Object.keys(ANTIGUEDAD) as Antiguedad[]}
            valor={antiguedad}
            onChange={setAntiguedad}
          />
        </>
      )}
      <Body muted style={{ fontSize: 15 }}>
        La entidad que elijas define la tasa y las cuotas.
      </Body>
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
