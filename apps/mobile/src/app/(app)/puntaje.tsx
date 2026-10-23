import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Aviso,
  Body,
  Button,
  Card,
  Cargando,
  EscalaPuntaje,
  Label,
  Pasos,
  Screen,
  Title,
} from '@/components/ui';
import { solicitudActual, type Solicitud } from '@/lib/api';
import { mesLargo } from '@/lib/format';
import { colors, font, type } from '@/lib/theme';

/** T7: ver mi score con su escala y su explicación en lenguaje simple (TND-052, TND-053). */
export default function Puntaje() {
  const [sol, setSol] = useState<Solicitud | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      solicitudActual()
        .then(setSol)
        .catch((e: Error) => setError(e.message));
    }, []),
  );

  if (error)
    return (
      <Screen>
        <Aviso tono="error">{error}</Aviso>
      </Screen>
    );
  if (!sol?.score)
    return (
      <Screen>
        <Cargando texto="Cargando tu puntaje…" />
      </Screen>
    );
  const s = sol.score;
  const diferencia = sol.scoreOriginal ? s.puntaje - sol.scoreOriginal.puntaje : 0;

  return (
    <Screen
      footer={
        <>
          <Button
            testID="compartir"
            title="Compartir con una entidad"
            onPress={() => router.push('/enviar')}
          />
          <Button
            testID="justificar"
            title="Justificar un mes malo"
            variant="secondary"
            onPress={() => router.push('/justificar')}
          />
        </>
      }
    >
      <Pasos actual={3} />
      <Title>Tu Puntaje TendIA</Title>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text
            testID="puntaje"
            style={{
              fontFamily: font.extrabold,
              fontSize: type.hero,
              color: colors.indigo700,
              lineHeight: 72,
            }}
          >
            {s.puntaje}
          </Text>
          <Text style={{ fontFamily: font.semibold, fontSize: 20, color: colors.neutral600 }}>
            de 100
          </Text>
        </View>
        <EscalaPuntaje puntaje={s.puntaje} nivelIndice={s.nivelIndice} />
        {sol.scoreOriginal && (
          <Aviso tono="ok">
            Con tu justificación tu puntaje{' '}
            {diferencia > 0
              ? `subió ${diferencia} puntos`
              : diferencia < 0
                ? `bajó ${-diferencia} puntos`
                : 'se mantuvo'}{' '}
            (antes: {sol.scoreOriginal.puntaje}).
          </Aviso>
        )}
      </Card>
      <Body>{s.explicacion.resumen}</Body>
      {s.explicacion.fortalezas.length > 0 && (
        <Card>
          <Label>Lo que te ayuda</Label>
          {s.explicacion.fortalezas.map((f) => (
            <Body key={f}>✓ {f}</Body>
          ))}
        </Card>
      )}
      {s.explicacion.aMejorar.length > 0 && (
        <Card>
          <Label>Lo que puedes mejorar</Label>
          {s.explicacion.aMejorar.map((f) => (
            <Body key={f}>→ {f}</Body>
          ))}
        </Card>
      )}
      {sol.variaciones.length > 0 && (
        <Card>
          <Label>Meses que justificaste</Label>
          {sol.variaciones.map((v) => (
            <Body key={v.mes}>
              <Text style={{ fontFamily: font.bold }}>{mesLargo(v.mes)}:</Text> {v.motivo}
            </Body>
          ))}
        </Card>
      )}
      <Aviso>
        Este no es un puntaje de DataCrédito. Lo calculamos solo con los datos de tu negocio. TendIA
        no presta dinero: tú decides con qué entidad compartirlo.
      </Aviso>
    </Screen>
  );
}
