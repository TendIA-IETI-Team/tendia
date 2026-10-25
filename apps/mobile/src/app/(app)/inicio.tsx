import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Aviso, Body, Button, Card, Cargando, Screen, Title } from '@/components/ui';
import { api, solicitudActual, type Perfil, type Solicitud } from '@/lib/api';
import { pesos } from '@/lib/format';
import { rutaPara } from '@/lib/rutas';
import { useSesion } from '@/lib/sesion';
import { colors, font } from '@/lib/theme';

export default function Inicio() {
  const { salir } = useSesion();
  const [sol, setSol] = useState<Solicitud | null | undefined>(undefined);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setError(null);
      Promise.all([solicitudActual(), api<Perfil>('/me')])
        .then(([s, p]) => {
          setSol(s);
          setPerfil(p);
        })
        .catch((e: Error) => setError(e.message));
    }, []),
  );

  const terminada = sol && (sol.estado === 'APROBADA' || sol.estado === 'RECHAZADA');

  return (
    <Screen
      footer={
        <>
          {sol && !terminada ? (
            <Button
              testID="continuar"
              title="Continuar mi solicitud"
              onPress={() => router.push(rutaPara(sol))}
            />
          ) : (
            <Button
              testID="solicitar"
              title="Solicitar un crédito"
              onPress={() => router.push('/solicitar')}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="tendi"
                title="Hablar con Tendi"
                variant="accent"
                onPress={() => router.push('/asistente')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="mi-cuaderno"
                title="Mi cuaderno"
                variant="secondary"
                onPress={() => router.push('/cuaderno')}
              />
            </View>
          </View>
          <Button
            title="Mis autorizaciones"
            variant="link"
            onPress={() => router.push('/autorizaciones')}
          />
        </>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Image source={require('../../../assets/logo.png')} style={{ width: 48, height: 48 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: font.extrabold, fontSize: 22, color: colors.indigo700 }}>
            TendIA
          </Text>
          <Text style={{ fontFamily: font.regular, fontSize: 15, color: colors.neutral600 }}>
            {perfil?.negocio?.nombre ?? perfil?.celular ?? ''}
          </Text>
        </View>
        <Button title="Salir" variant="link" onPress={() => void salir()} />
      </View>
      <Title>{perfil?.nombre ? `Hola, ${perfil.nombre.split(' ')[0]}` : 'Hola'}</Title>
      {error && <Aviso tono="error">{error}</Aviso>}
      {sol === undefined && !error ? (
        <Cargando texto="Cargando…" />
      ) : sol ? (
        <Card>
          <Text style={{ fontFamily: font.bold, fontSize: 15, color: colors.neutral600 }}>
            TU SOLICITUD
          </Text>
          <Text style={{ fontFamily: font.extrabold, fontSize: 28, color: colors.indigo900 }}>
            {pesos(sol.monto)}
          </Text>
          <Body muted>
            {sol.destino} · {sol.plazoMeses} meses
          </Body>
          <Aviso
            tono={
              sol.estado === 'APROBADA' ? 'ok' : sol.estado === 'RECHAZADA' ? 'warning' : 'info'
            }
          >
            {sol.estadoTexto}
          </Aviso>
          {sol.score && (
            <Body>
              Tu Puntaje TendIA:{' '}
              <Text style={{ fontFamily: font.extrabold, color: colors.indigo700 }}>
                {sol.score.puntaje}
              </Text>{' '}
              de 1000
            </Body>
          )}
        </Card>
      ) : (
        <Card>
          <Body>
            Pide un crédito para tu tienda. Te mostramos tu Puntaje TendIA y por qué, antes de
            compartirlo con una entidad.
          </Body>
        </Card>
      )}
      <Body muted style={{ fontSize: 15 }}>
        TendIA no presta dinero: evalúa tu negocio y comparte tu puntaje solo con la entidad que tú
        elijas.
      </Body>
    </Screen>
  );
}
