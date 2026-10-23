import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Aviso, Body, Button, Pasos, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Solicitud } from '@/lib/api';
import { colors, font } from '@/lib/theme';

const MENSAJES = [
  'Conectando con tus ventas…',
  'Revisando tus pagos al proveedor…',
  'Comparando las fuentes…',
  'Calculando tu Puntaje TendIA…',
];

/** Trae los datos autorizados y calcula; devuelve la pantalla siguiente. */
async function evaluar(): Promise<'/solicitar' | '/completar' | '/puntaje'> {
  const inicio = Date.now();
  const s = await solicitudActual();
  if (!s) return '/solicitar';
  const r = await api<Solicitud>(`/solicitudes/${s.id}/evaluar`, { method: 'POST' });
  // Tiempo mínimo para que el tendero alcance a leer qué está pasando.
  await new Promise((ok) => setTimeout(ok, Math.max(0, 2400 - (Date.now() - inicio))));
  return r.estado === 'DATOS_INCOMPLETOS' ? '/completar' : '/puntaje';
}

/** T4 y T6: pantallas de espera automáticas mientras se traen datos y se calcula (TND-051). */
export default function Evaluando() {
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [demorado, setDemorado] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, MENSAJES.length - 1)), 650);
    // Si tarda más de 30 segundos, un mensaje de calma (TND-051).
    const calma = setTimeout(() => setDemorado(true), 30_000);
    evaluar()
      .then((ruta) => router.replace(ruta))
      .catch((e: Error) => setError(e.message));
    return () => {
      clearInterval(t);
      clearTimeout(calma);
    };
  }, [intento]);

  return (
    <Screen
      footer={
        error ? (
          <Button
            title="Intentar de nuevo"
            onPress={() => {
              setError(null);
              setIntento((i) => i + 1);
            }}
          />
        ) : undefined
      }
    >
      <Pasos actual={3} />
      <Title>Estamos revisando tu negocio</Title>
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <ActivityIndicator size="large" color={colors.indigo700} />
      </View>
      {MENSAJES.map((m, i) => (
        <Text
          key={m}
          style={{
            fontFamily: i <= paso ? font.bold : font.regular,
            fontSize: 18,
            color: i <= paso ? colors.indigo900 : colors.neutral300,
          }}
        >
          {i < paso ? '✓ ' : i === paso ? '• ' : '  '}
          {m}
        </Text>
      ))}
      <Body muted>Esto toma unos segundos. No cierres la app.</Body>
      {demorado && !error && (
        <Aviso>
          Está tardando un poco más de lo normal. Tranquilo, seguimos trabajando en tu puntaje.
        </Aviso>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
    </Screen>
  );
}
